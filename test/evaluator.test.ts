import { EraSpec, sliceByEra, Era, Slice, scanSlices } from "../lib/sliceByEra";
import { Subject, OperatorFunction, Observable, pipe, from } from "rxjs";
import { Dict, reduceToDict, tup, reduceToArray, enumerate, Keyed$ } from "../lib/utils";
import { startWith, map, concatMap, groupBy } from "rxjs/operators";
import { Model } from "../lib/bits";


type LogRef = string;
    

type Evaluable = {
    logRefs: Observable<LogRef>,
    evaluate(ref: LogRef) : Observable<any>
}


function evaluate<U, A>() : OperatorFunction<Era<Keyed$<U>>, Era<Evaluable>> {
    return pipe(
        scanSlices<Keyed$<U>, Evaluable>(
            (prev, curr) => ({
                logRefs: curr.pipe(map(g => g.key)),
                evaluate() {
                    throw 123;
                }
            }),
            null));
}


type TestRipple = Keyed$<number>

describe('evaluator', () => {

    let spec$: Subject<EraSpec>
    let ripple$: Subject<Keyed$<number>>
    let gathering: Promise<Slice<Dict>[][]>

    const model: Model<number, string> = {
        zero: '',
        add: (aggr, u) => aggr + u
    }
    

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
                [ [0, 1], { a: '1,2' } ]
            ]
        ]);
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
        return gathering;
    }


    async function expectOut(expected: Slice<Dict<any>>[][]) {
        const r = await complete();
        expect(r).toEqual(expected);
    }

    function materialize() : OperatorFunction<Era<Evaluable>, Slice<Dict<any>>[][]> {
        return pipe(
            concatMap(([_, slices]) => 
                slices.pipe(
                    concatMap(([range, { logRefs, evaluate }]) =>
                        logRefs.pipe(
                            concatMap(ref => evaluate(ref).pipe(
                                                map(v => tup(ref, v)))),
                            reduceToDict(),
                            map(d => tup(range, d)))),
                    reduceToArray())),
            reduceToArray());
    }


})