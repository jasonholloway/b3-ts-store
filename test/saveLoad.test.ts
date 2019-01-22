import { Subject, from, OperatorFunction, pipe, empty, Observable, Observer, of, ReplaySubject, merge, concat, MonoTypeOperatorFunction } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, log } from "../lib/utils";
import { slicer, pullAll, Ripple, Part, Tuple2, EraWithSlices } from "../lib/slicer";
import { map, concatMap, groupBy, mapTo, tap, startWith, reduce, concatAll, catchError, flatMap, single } from "rxjs/operators";
import { evaluate, Evaluable } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, Commit } from "../lib/committer";
import FakeManifestStore from "./fakes/FakeManifestStore";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { Signal, specifier, newEra, NewManifest, newManifest, EraWithSpec, Manifest } from "../lib/specifier";
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


const pusher = 
    (blockStore: BlockStore, manifestStore: ManifestStore, pull$: Observer<PullManifest>) : OperatorFunction<Commit, Commit> =>
    pipe(
        concatMap(commit =>
            of(commit.data).pipe(
                concatMap(async data => {
                    const ref = 'block0';
                    await blockStore.save(ref, commit.data);
                    return ref;
                }),
                concatMap(blockRef => {
                    const logRefs = enumerate(commit.data).map(([k]) => k);
        
                    const manifest: Manifest = {
                        ...commit.era.manifest,
                        version: commit.era.manifest.version + 1,
                        logBlocks: { myLog: [ 'block0' ] }
                    };
                    
                    return manifestStore.save(manifest)
                            .pipe(tap({ 
                                error: () => pull$.next(['PullManifest', {}])
                            }));
                }),
                mapTo(commit),
                mergeErrorsInto(commit)
            ))
        );


function mergeErrorsInto<F extends { errors: Observable<Error> }>(frame: F) : MonoTypeOperatorFunction<F> {
    return catchError(err => 
        of({ 
            ...frame as object,
            errors: concat(frame.errors, of(err)) 
        } as F));
}

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
    let commit$: Observable<Commit>

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

        era$ =      merge(signal$, manifest$).pipe(
                        startWith(newEra()),
                        specifier(),
                        serveBlocks(blockStore),
                        slicer(ripple$),
                        evaluate(model),
                        pullAll());

        commit$ =   doCommit$.pipe(
                        committer(model, era$, signal$),
                        pusher(blockStore, manifestStore, pullManifest$),
                        pullAllCommits());

        const error$ = merge(commit$).pipe(
                        concatMap(({errors}) => errors)
                        );

        //NB: an error will still output a commit, it seems...
        //as otherwise how will the error get out?
        //
        //but then, surely the pusher will still act on it?!?!?!?
        //
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

        it('triggers new era (to grab slice)', async () => {            
            const eras = await era$
                                .pipe(reduceToArray())
                                .toPromise();

            expect(eras).toMatchObject([ { id: 0 }, { id: 1} ]);
        })

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
                .toEqual([ 0, 121, 121, 123 ]));

        it('error emitted into Commit', async () => {
            const errs = await commit$.pipe(
                                concatMap(c => c.errors),
                                reduceToArray()
                            ).toPromise();

            expect(errs).toMatchObject([ 'Newer manifest in place!' ]);
        })
    })


    function getManifestVersions() {
        return toArray(era$.pipe(
                map(({ manifest: { version }}) => version)));
    }

    function toArray<V>(v$: Observable<V>) {
        return v$.pipe(reduceToArray()).toPromise();
    }

    function pullAllCommits() : MonoTypeOperatorFunction<Commit> {
        return pipe(
            map(commit => ({ 
                ...commit ,
                errors: commit.errors.pipe(pullAll())
            })),
            pullAll())
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