import { EraSpec, sliceByEra, Era, Slice } from "../lib/sliceByEra";
import { Subject, OperatorFunction, Observable, pipe } from "rxjs";
import { Dict, reduceToDict, tup, reduceToArray } from "../lib/utils";
import { startWith, map, concatMap, single } from "rxjs/operators";


type TestRipple = Dict<number[]>
type LogRef = string;

type Evaluator = () => Observable<[LogRef, Observable<any>]>


function evaluate<U>() : OperatorFunction<Era<U>, Era<Evaluator>> {
    throw 123;
}


describe('evaluator', () => {

    let spec$: Subject<EraSpec>
    let ripple$: Subject<TestRipple>
    let gathering: Promise<Slice<Dict>[][]>


    beforeEach(() => {
        spec$ = new Subject<EraSpec>();
        ripple$ = new Subject<TestRipple>();

        gathering = spec$.pipe(
                        startWith(0),
                        sliceByEra(ripple$),
                        evaluate())
                    .pipe(materialize())                    
                    .toPromise();
    })


    it('evaluates single slice', async () => {
        ripple({ a: [1, 2] });
    
        await expectOut([
            [
                [ [0, 0], {} ]
            ]
        ]);
    })


    function ripple(rip: TestRipple) {
        ripple$.next(rip);
    }

    function complete() {
        ripple$.complete();
        spec$.complete();
        return gathering;
    }


    async function expectOut(expected: Slice<Dict<any>>[][]) {
        const r = await complete();
        expect(r).toEqual(expected);
    }

    function materialize() : OperatorFunction<Era<Evaluator>, Slice<Dict>[][]> {
        return pipe(
            concatMap(([_, slices]) => 
                slices.pipe(
                    concatMap(([range, evaluate]) => 
                        evaluate().pipe(
                            concatMap(([key, val$]) => 
                                val$.pipe(single(), map(val => tup(key, val)))),
                            reduceToDict(),
                            map(d => tup(range, d)))),
                    reduceToArray())),
            reduceToArray());
    }


})