import { slicer, Slice, concatMapSlices, materializeSlices, pullAllSlices, EraWithSlices, Ripple } from "../lib/core/slicer";
import { Subject, from, Observable, zip } from "rxjs";
import { Dict, reduceToDict, tup, reduceToArray, enumerate } from "../lib/utils";
import { map, concatMap, groupBy } from "rxjs/operators";
import { Evaluable, evaluateSlices } from "../lib/core/evaluateSlices";
import { TestModel } from "./fakes/testModel";
import { specifier, emptyManifest, Manifest } from "../lib/core/specifier";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { newEpoch } from "../lib/core";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";


xdescribe('evaluateSlices', () => {

    const model = new TestModel();

    let manifest$: Subject<Manifest>;
    let ripple$: Subject<Ripple<number>>
    let blockStore: FakeBlockStore

    let era$: Observable<EraWithSlices<[Ripple, Evaluable<TestModel>]>>

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
                evaluateSlices(model),
                pullAllSlices());

        manifest$.next(emptyManifest);
    })


    it('passes through raw logs in tuple', async () => {
        ripple({ myLog: [1, 2], myLog2: [ 9 ] });
    
        await expectLogRefs([
            [
                [ [0, 1], ['myLog', 'myLog2'] ]
            ]
        ]);
    })


    describe('logRefs', () => {
        it('advertises known log refs', async () => {
            ripple({ myLog: [1, 2], myLog2: [ 9 ] });
        
            await expectLogRefs([
                [
                    [ [0, 1], ['myLog', 'myLog2'] ]
                ]
            ]);
        })

        it('ignores log refs without updates', async () => {
            ripple({ myLog: [], myLog2: [ 9 ] });
        
            await expectLogRefs([
                [
                    [ [0, 1], ['myLog2'] ]
                ]
            ]);
        })
    })


    describe('evaluate', () => {
        it('single slice', async () => {
            ripple({ myLog: [1, 2] });
        
            await expectAggrs([
                [
                    [ [0, 1], { myLog: '1,2' } ]
                ]
            ]);
        })
    
    
        it('second slice', async () => {
            ripple({ myLog: [1, 2] });
            ripple({ myLog: [3, 4] });
    
            await expectAggrs([
                [
                    [ [0, 1], { myLog: '1,2' } ],
                    [ [1, 2], { myLog: '1,2,3,4' } ]
                ]
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
                [
                    [ [0, 1], { myLog: '5,6' } ]
                ],
                [                
                    [ [0, 1], { myLog: '1,2,3,4,5,6' } ]
                ]
            ]);
        })
    })


    describe('when strange log encountered', () => {

        it('not listed in logRefs', async () => {
            ripple({ flibble: [1] });

            await expectLogRefs([
                [
                    [ [0, 1], [] ]
                ]
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




    async function expectAggrs(expected: Slice<Dict<any>>[][]) {
        complete();

        const r = await era$.pipe(
                        concatMapSlices(([_, {logRef$: logRefs, evaluate}]) => 
                            logRefs.pipe(
                                concatMap(ref => evaluate(ref).pipe(
                                                    map(v => tup(ref, v)))),
                                reduceToDict())),
                        materializeSlices()
                    ).toPromise();

        expect(r).toEqual(expected);
    }

    async function expectLogRefs(expected: Slice<string[]>[][]) {
        complete();

        const r = await era$.pipe(
                        concatMapSlices(([_, {logRef$: logRefs}]) => 
                            logRefs.pipe(reduceToArray())),                            
                        materializeSlices()
                    ).toPromise();

        expect(r).toEqual(expected);
    }

})


