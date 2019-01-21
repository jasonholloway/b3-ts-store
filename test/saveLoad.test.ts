import { Subject, from, OperatorFunction, pipe, empty, Observable, Observer, GroupedObservable, of, ReplaySubject, merge } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, log } from "../lib/utils";
import { slicer, pullAll, Ripple, Part, Tuple2, EraWithSlices } from "../lib/slicer";
import { map, concatMap, groupBy, mapTo, tap, startWith, reduce, concatAll, concat, defaultIfEmpty, sample, catchError } from "rxjs/operators";
import { evaluate, Evaluable } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, DoStore } from "../lib/committer";
import FakeManifestStore from "./fakes/FakeManifestStore";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { Signal, specifier, newEra, NewManifest, newManifest, EraWithSpec } from "../lib/specifier";
import { serveBlocks } from "../lib/serveBlocks";
import { BlockStore, ManifestStore } from "../lib/bits";
import { pause } from "./utils";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

//the Pusher:
//1) saves a block
//2) tries to save a new Manifest
//3) on success, emits new Spec
//4) on failure, should emit an informational warning

//but, to emit a warning, we need tobe in an EraWithErrors, instead of just consuming from DoStore
//though, such errors of committing don't really belong to the era, they belong to the attempted commit...
//
//instead of eras piped into the committer, the commiter would primarily consume DoCommits,
//and sample eras as a secondary input; this would then allow the DoCommit to becomea kind of CommitContext
//passed through the stack
//
//the Commit would then gather state as it went through: including errors on trying to save
//
//
//

type PullManifest = ['PullManifest', {}]

const puller =
    (manifestStore: ManifestStore) : OperatorFunction<PullManifest, NewManifest> =>
    pipe(
        concatMap(([_, pull]) => manifestStore.load()),     //but what happens if empty????
        map(manifest => newManifest(manifest))
    );

//if the pusher, on finding a later manifest in the store,
//just sent out a signal saying to 
//
//



const pusher = 
    (blockStore: BlockStore, manifestStore: ManifestStore, pull$: Observer<PullManifest>) : OperatorFunction<DoStore<any>, any> =>
    pipe(
        concatMap(({ data }) => 
            data.pipe(materializeParts())),
        concatMap((block) => 
            blockStore.save('block0', block)),
        concatMap(() => 
            manifestStore.save({ version: 1, logBlocks: { myLog: [ 'block0' ] } })
                .pipe(catchError(() => {
                    pull$.next(['PullManifest', {}]);
                    return empty(); //bodge - should emit error too
                }))),
        pullAll(false)
    );   

function materializeParts<V>() : OperatorFunction<Part<V>, Dict<V[]>> {
    return pipe(
            reduce((prev$, [k, u$]: Part<V>) => 
                prev$.pipe(
                    concatMap(prev =>
                        u$.pipe(
                            reduceToArray(),
                            map(r => ({ ...prev, [k]: r }))))),
                of({} as Dict<V[]>)),
            concatAll());
}


describe('saveLoad', () => {

    const model = new TestModel();

    let manifestStore: FakeManifestStore
    let blockStore: FakeBlockStore

    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>
    let pullManifest$: Subject<PullManifest>

    let manifest$: Observable<NewManifest>
    let era$: Observable<EraWithSlices<Evaluable<TestModel>> & EraWithSpec>
    let commit$: Observable<any>

    beforeEach(() => {
        manifestStore = new FakeManifestStore();
        blockStore = new FakeBlockStore();

        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();
        pullManifest$ = new ReplaySubject<PullManifest>();

        manifest$ = pullManifest$.pipe(
                        puller(manifestStore),
                        pullAll());

        era$ = merge(signal$, manifest$).pipe(
                startWith(newEra()),
                specifier(),
                serveBlocks(blockStore),
                slicer(ripple$),
                evaluate(model),
                pullAll());

        commit$ = doCommit$.pipe(
                    committer<TestModel>(era$, signal$),
                    pusher(blockStore, manifestStore, pullManifest$),
                    pullAll());
    })


    describe('on commit', () => {
        beforeEach(async () => {
            emit({ myLog: [ 1, 2, 3 ] });
            doCommit();
    
            complete();
            await pause();
        })

        it('saves new block', () => 
            expect(blockStore.blocks)
                .toHaveProperty('block0', { myLog: [ 1, 2, 3 ] }))
                
        it('saves new manifest', () => 
            expect(manifestStore.manifest).toEqual({
                version: 1,
                logBlocks: {
                    myLog: [ 'block0' ]
                }
            }))
    })

    describe('when there\'s an existing, newer manifest', () => {
        beforeEach(async () => {
            manifestStore.manifest = { version: 123, logBlocks: {} };

            signal$.next(newManifest({ version: 121, logBlocks: {} }));
            emit({ myLog: [ 1, 2, 3 ] });
            doCommit();
    
            await pause();
            complete();
        })

        it('manifest isn\'t updated', () =>                         //though this is responsibility of store, rather than pusher
            expect(manifestStore.manifest.version).toBe(123));
        
        it('pullManifest signal sent', async () => {
            const pulls = await toArray(pullManifest$);
            expect(pulls).toEqual([
                ['PullManifest', {}]
            ]);
        })

        it('newer manifest pulled in', async () =>
            expect(await toArray(manifest$))
                .toEqual([
                    ['NewManifest', { version: 123, logBlocks: {} }]
                ]));

        it('newer manifest percolates into new era', async () =>
            expect(await getManifestVersions())
                .toEqual([ 0, 121, 123 ]));

        xit('error emitting into DoCommit context', () => {
            //...
        })

    })


    function getManifestVersions() {
        return toArray(era$.pipe(
                map(({ manifest: { version }}) => version)));
    }

    function toArray<V>(v$: Observable<V>) {
        return v$.pipe(reduceToArray()).toPromise();
    }

    
    function emit(rip: TestRipple) {
        const ripple = from(enumerate(rip)).pipe(
                        concatMap(
                            ([k, r]) => from(r).pipe(map(v => tup(k, v)))),
                        groupBy(
                            ([k]) => k, 
                            ([_, v]) => v),
                        map(g => tup(g.key, g)));

        ripple$.next(ripple);
    }

    function doCommit() {
        doCommit$.next();
    }

    function complete() {
        ripple$.complete();
        signal$.complete();
        doCommit$.complete();
        pullManifest$.complete();
    }

})