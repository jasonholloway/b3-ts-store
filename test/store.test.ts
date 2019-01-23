import { Subject, from, pipe, Observable, MonoTypeOperatorFunction } from "rxjs";
import { reduceToArray, Dict, enumerate, tup } from "../lib/utils";
import { pullAll, Ripple, EraWithSlices } from "../lib/slicer";
import { map, concatMap, groupBy } from "rxjs/operators";
import { Evaluable } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, Commit } from "../lib/committer";
import FakeManifestStore from "./fakes/FakeManifestStore";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { EraWithSpec } from "../lib/specifier";
import { pause } from "./utils";
import { Store, createStore } from "../lib/createStore";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('store', () => {

    const model = new TestModel();

    let manifestStore: FakeManifestStore
    let blockStore: FakeBlockStore

    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>

    let era$: Observable<EraWithSlices<Evaluable<TestModel>> & EraWithSpec>
    let commit$: Observable<Commit>

    let store: Store<TestModel>

    beforeEach(() => {
        manifestStore = new FakeManifestStore();
        blockStore = new FakeBlockStore();

        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();

        manifestStore.manifest = { version: 10, logBlocks: {} };

        store = createStore(model, blockStore, manifestStore)(ripple$, doCommit$);

        era$ = store.era$.pipe(pullAll());
        commit$ = store.commit$.pipe(pullAllCommits());
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
                version: 11,
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


    describe('on start', () => {
        beforeEach(async () => {
            await pause();
            complete();
        })

        it('pulls in latest manifest from store', async () => {
            expect(await getManifestVersions())
                .toEqual([ 10 ]);
        })
    })



    describe('when there\'s an existing, newer manifest', () => {
        beforeEach(async () => {
            manifestStore.manifest = { version: 999, logBlocks: {} };

            emit({ myLog: [ 1, 2, 3 ] });
            doCommit();
    
            await pause();
            complete();
        })

        it('manifest isn\'t updated', () =>                         //though this is responsibility of store, rather than pusher
            expect(manifestStore.manifest.version).toBe(999));
        
        it('newer manifest percolates into new era', async () =>
            expect(await getManifestVersions())
                .toEqual([ 10, 10, 999 ]));

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
        doCommit$.complete();
    }

})