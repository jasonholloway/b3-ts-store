import { slicer, Slice, concatMapSlices, materializeSlices, pullAllSlices, EraWithSlices, Ripple } from "../lib/slicer";
import { Subject, from, empty, Observable } from "rxjs";
import { Dict, reduceToDict, tup, reduceToArray, enumerate } from "../lib/utils";
import { startWith, map, concatMap, groupBy } from "rxjs/operators";
import { Evaluable, evaluate } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { specifier, Signal, newEra, newManifest } from "../lib/specifier";
import { serveBlocks } from "../lib/serveBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";


describe('evaluator', () => {

    const model = new TestModel();

    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple<number>>
    let blockStore: FakeBlockStore

    let gathering: Observable<EraWithSlices<Evaluable<TestModel>>>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();

        gathering = signal$.pipe(
                        startWith(newEra()),
                        specifier(),
                        serveBlocks(blockStore),
                        slicer(ripple$),
                        evaluate(model))
                    .pipe(pullAllSlices());
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

            signal$.next(newManifest({
                id: 1,
                logBlocks: {
                    myLog: ['block0', 'block1']
                }
            }));

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
        signal$.complete();
    }




    async function expectAggrs(expected: Slice<Dict<any>>[][]) {
        complete();

        const r = await gathering.pipe(
                        concatMapSlices(({logRefs, evaluate}: Evaluable<TestModel>) => 
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

        const r = await gathering.pipe(
                        concatMapSlices(({logRefs}: Evaluable<TestModel>) => 
                            logRefs.pipe(reduceToArray())),                            
                        materializeSlices()
                    ).toPromise();

        expect(r).toEqual(expected);
    }

})



