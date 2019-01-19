import { slicer, Slice, concatMapSlices, materializeSlices, pullAllSlices, EraWithSlices, EraWithThresh, mapSlices } from "../lib/slicer";
import { Subject, from, empty, Observable } from "rxjs";
import { Dict, reduceToDict, tup, reduceToArray, enumerate, Keyed$ } from "../lib/utils";
import { startWith, map, concatMap, groupBy, tap } from "rxjs/operators";
import { Evaluable, evaluate } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";


type TestRipple = Keyed$<number>;


describe('evaluator', () => {

    const model = new TestModel();

    let spec$: Subject<EraWithThresh>
    let ripple$: Subject<Keyed$<number>>
    let gathering: Observable<EraWithSlices<Evaluable<TestModel>>>

    beforeEach(() => {
        spec$ = new Subject<EraWithThresh>();
        ripple$ = new Subject<TestRipple>();

        gathering = spec$.pipe(
                        startWith({ id: 0, thresh: 0}),
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
                            groupBy(([k, _]) => k, ([_, v]) => v));
                    
        ripple$.next(ripple);
    }

    function complete() {
        ripple$.complete();
        spec$.complete();
    }


    async function expectData(expected: Slice<Dict<any[]>>[][]) {
        complete();

        const r = await gathering.pipe(
                        concatMapSlices(({data}: Evaluable<TestModel>) => empty()),
                        materializeSlices()
                    ).toPromise();

        expect(r).toEqual(expected);
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



