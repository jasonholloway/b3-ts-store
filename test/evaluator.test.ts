import { EraSpec, sliceByEra, Era, Slice, scanSlices } from "../lib/sliceByEra";
import { Subject, OperatorFunction, Observable, pipe, from, empty, of } from "rxjs";
import { Dict, reduceToDict, tup, reduceToArray, enumerate, Keyed$ } from "../lib/utils";
import { startWith, map, concatMap, groupBy, tap, flatMap, filter, scan, defaultIfEmpty } from "rxjs/operators";
import { Model as LogModel } from "../lib/bits";


type LogRef = string;

type ExtractRefs<M extends Model>
    = Extract<keyof M['logs'], string>;

type ExtractAggr<M extends Model, K extends keyof M['logs']>
    = M['logs'][K]['zero']


type Evaluable<M extends Model> = {
    logRefs: Observable<ExtractRefs<M>>,
    evaluate<K extends ExtractRefs<M>>(ref: K) : Observable<ExtractAggr<M, K>>
}


type Model = {
    logs: { [ref: string]: LogModel<any, any> }
}

const model = {
    logs: {
        myLog: {
            zero: '',
            add: (ac: string, v: number) => 
                ac == '' ? v : (ac + ',' + v)
        }        
    }
}



function evaluate<U, A, M extends Model>(model: M) : OperatorFunction<Era<Keyed$<U>>, Era<Evaluable<M>>> {
    return pipe(
        scanSlices<Keyed$<U>, Evaluable<M>>(
            ( prev, curr$) => ({
                logRefs: curr$.pipe(map(g => g.key)) as any,    //needed as model doesn't exist upstream - we could guard against strange data here?
                evaluate(ref) {
                    const m = model.logs[ref];
                    
                    return prev.evaluate(ref).pipe(
                            defaultIfEmpty(m.zero),
                            flatMap(ac => curr$.pipe(
                                            filter(g => g.key == ref),                  //filtering without a map is lame
                                            concatMap(u$ => u$.pipe(scan(m.add, ac))))
                                            ));
                }
            }),
            { logRefs: empty(), evaluate: () => empty() }));
}


type TestRipple = Keyed$<number>

describe('evaluator', () => {

    let spec$: Subject<EraSpec>
    let ripple$: Subject<Keyed$<number>>
    let gathering: Promise<Slice<Dict>[][]>

    beforeEach(() => {
        spec$ = new Subject<EraSpec>();
        ripple$ = new Subject<TestRipple>();

        gathering = spec$.pipe(
                        startWith(0),
                        sliceByEra(ripple$),
                        evaluate(model))
                    .pipe(materialize())                    
                    .toPromise();
    })


    it('evaluates single slice', async () => {
        ripple({ myLog: [1, 2] });
    
        await expectOut([
            [
                [ [0, 1], { myLog: '1,2' } ]
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

    function materialize<M extends Model>() : OperatorFunction<Era<Evaluable<M>>, Slice<Dict<any>>[][]> {
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