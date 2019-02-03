import { Subject, from, pipe, Observable, MonoTypeOperatorFunction } from "rxjs";
import { Dict, enumerate, tup } from "../lib/utils";
import { map, concatMap, groupBy, toArray } from "rxjs/operators";
import { TestModel } from "./fakes/testModel";
import { DoCommit, Commit } from "../lib/core/committer";
import FakeManifestStore from "./fakes/FakeManifestStore";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { pause } from "./utils";
import { Core, createCore } from "../lib/core";
import { EvaluableEra } from "../lib/core/evaluator";
import { gather } from "./helpers";
import { pullAll, Ripple } from "../lib/core/eraSlicer";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('core', () => {

    const model = new TestModel();

    let manifestStore: FakeManifestStore
    let blockStore: FakeBlockStore

    let ripple$: Subject<Ripple<number>>
    let doReset$: Subject<void>
    let doCommit$: Subject<DoCommit>

    let era$: Observable<EvaluableEra<TestModel>>
    let commit$: Observable<Commit>

    let core: Core<TestModel>

    beforeEach(() => {
        manifestStore = new FakeManifestStore();
        blockStore = new FakeBlockStore();

        ripple$ = new Subject<Ripple<number>>();
        doReset$ = new Subject<void>();
        doCommit$ = new Subject<DoCommit>();

        manifestStore.manifest = { version: 10, logBlocks: { myLog2: [ 'block1' ] } };
        blockStore.blocks = { block1: { myLog2: [ 4, 5, 6 ] } }

        core = createCore(model, blockStore, manifestStore)(ripple$, doReset$, doCommit$);

        era$ = core.era$.pipe(pullAll());
        commit$ = core.commit$.pipe(pullAllCommits());
    })

    describe('viewing', () => {

        it('serves views of staged updates', async () => {
            const viewing = gather(core.view('myLog'));

            emit({ myLog: [ 1, 2, 3 ] });
            await pause();
            complete();

            expect(await viewing).toEqual([ '1,2,3' ]);
        })

        it('serves views of existing blocks', async () => {
            await pause();
            complete();

            const r = await gather(core.view('myLog2'));
            expect(r).toEqual([ '4,5,6' ]);
        })

    })


    describe('on reset', () => {

        it('triggers new era', async () => {
            emit({ myLog: [ 1, 2, 3 ] });
            doReset();
            complete();

            const eras = await gather(era$);
            expect(eras).toMatchObject([ { id: 0 }, { id: 1 } ]);
        })

        it('reemits base view', async () => {
            emit({ myLog2: [ 7, 8, 9 ] });
            await pause();
            doReset();
            await pause();
            complete();

            const r = await gather(core.view('myLog2'));
            expect(r).toEqual([ '4,5,6' ]);
        })

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
            const eras = await gather(era$);
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
            const errs = await gather(commit$.pipe(concatMap(c => c.errors)));
            expect(errs).toMatchObject([ 'Newer manifest in place!' ]);
        })
    })


    function getManifestVersions() {
        return gather(era$.pipe(
                map(({ manifest: { version }}) => version)));
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

    function doReset() {
        doReset$.next();
    }

    function complete() {
        ripple$.complete();
        doCommit$.complete();
        doReset$.complete();
    }

})