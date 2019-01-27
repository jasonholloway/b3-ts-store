import { slicer, Slice, concatMapSlices, materializeSlices, pullAllSlices, Ripple } from "../lib/core/slicer";
import { Subject, from, Observable, zip } from "rxjs";
import { Dict, reduceToDict, tup, reduceToArray, enumerate } from "../lib/utils";
import { map, concatMap, groupBy, toArray } from "rxjs/operators";
import { TestModel } from "./fakes/testModel";
import { specifier, emptyManifest, Manifest } from "../lib/core/specifier";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { newEpoch } from "../lib/core";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { evaluator, EvaluableEra } from "../lib/core/evaluator";


describe('evaluator', () => {

    const model = new TestModel();

    let manifest$: Subject<Manifest>;
    let ripple$: Subject<Ripple<number>>
    let blockStore: FakeBlockStore

    let era$: Observable<EvaluableEra<TestModel>>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        manifest$ = new Subject<Manifest>();
        ripple$ = new Subject<Ripple<number>>();

        const epoch$ = zip(
                        manifest$,
                        manifest$.pipe(
                            pullBlocks(blockStore),
                            evaluateBlocks(model))
                    ).pipe(map(e => newEpoch(...e)));

        era$ = epoch$.pipe(
                specifier(),
                slicer(ripple$),
                evaluator(model),
                pullAllSlices());

        manifest$.next(emptyManifest);
    })


    it('passes through raw logs in tuple', async () => {
        ripple({ myLog: [1, 2], myLog2: [ 9 ] });
    
        await expectLogRefs([
            ['myLog', 'myLog2']
        ]);
    })


    describe('logRefs', () => {
        it('advertises known log refs', async () => {
            ripple({ myLog: [1, 2], myLog2: [ 9 ] });
        
            await expectLogRefs([
                ['myLog', 'myLog2']
            ]);
        })

        it('ignores log refs without updates', async () => {
            ripple({ myLog: [], myLog2: [ 9 ] });
        
            await expectLogRefs([
                ['myLog2']
            ]);
        })
    })


    describe('evaluate', () => {
        it('single slice', async () => {
            ripple({ myLog: [1, 2] });
        
            await expectAggrs([
                { myLog: '1,2' }
            ]);
        })
    
    
        it('second slice', async () => {
            ripple({ myLog: [1, 2] });
            ripple({ myLog: [3, 4] });
    
            await expectAggrs([
                { myLog: '1,2,3,4' }
            ]);
        })


        it('loads blocks first, given manifest', async () => {
            ripple({ myLog: [ 5, 6 ] });

            blockStore.blocks = {
                block0: { myLog: [ 1, 2 ] },
                block1: { myLog: [ 3, 4 ] }
            };

            manifest$.next({
                version: 1,
                logBlocks: {
                    myLog: ['block0', 'block1']
                }
            });

            await expectAggrs([
                { myLog: '5,6' },
                { myLog: '1,2,3,4,5,6' }
            ]);
        })
    })


    describe('when strange log encountered', () => {

        it('not listed in logRefs', async () => {
            ripple({ flibble: [1] });

            await expectLogRefs([
                []
            ]);
        })

    })



    function ripple(rip: Dict<number[]>) {
        const ripple = from(enumerate(rip)).pipe(
                            concatMap(([k, r]) => from(r).pipe(
                                                    map(v => tup(k, v)))),
                            groupBy(([k, _]) => k, ([_, v]) => v),
                            map(g => tup(g.key, g)));
                    
        ripple$.next(ripple);
    }

    function complete() {
        ripple$.complete();
        manifest$.complete();
    }




    async function expectAggrs(expected: Dict<string>[]) {
        complete();

        const all = await era$.pipe(
                            concatMap(era =>
                                era.logRefs.pipe(
                                    concatMap(ref => era.evaluate(ref).pipe(
                                                        map(v => tup(ref, v)))),
                                    reduceToDict()))
                        ).toPromise();

        expect(all).toEqual(expected);
    }

    async function expectLogRefs(expected: string[][]) {
        complete();

        const r = await era$.pipe(
                            concatMap(era => era.logRefs
                                                .pipe(toArray()))
                            ).toPromise();

        expect(r).toEqual(expected);
    }

})



