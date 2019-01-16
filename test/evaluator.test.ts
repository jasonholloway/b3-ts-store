import { EraSpec, sliceByEra, Era, Slice, scanSlices, concatMapSlices, materializeSlices, pullAllSlices } from "../lib/sliceByEra";
import { Subject, OperatorFunction, Observable, pipe, from, empty } from "rxjs";
import { Dict, reduceToDict, tup, reduceToArray, enumerate, Keyed$ } from "../lib/utils";
import { startWith, map, concatMap, groupBy, flatMap, filter, scan, defaultIfEmpty, tap, shareReplay } from "rxjs/operators";
import { Model as LogModel } from "../lib/bits";


type LogRef = string;

type Era$<V> = Observable<Era<V>>


type ExtractRefs<M extends Model>
    = Extract<keyof M['logs'], string>

type ExtractAggr<M extends Model, K extends keyof M['logs']>
    = M['logs'][K]['zero']


type Evaluable<M extends Model> = {
    logRefs: Observable<ExtractRefs<M>>,
    evaluate<K extends ExtractRefs<M>>(ref: K) : Observable<ExtractAggr<M, K>>
}


type Model = {
    logs: { [ref: string]: LogModel<any, any> }
}


class TestModel {
    logs = {
        myLog: {
            zero: '',
            add: (ac: string, v: number) => 
                ac == '' ? v : (ac + ',' + v)
        },
        myLog2: {
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


type TestRipple = Keyed$<number>;

describe('evaluator', () => {

    const model = new TestModel();

    let spec$: Subject<EraSpec>
    let ripple$: Subject<Keyed$<number>>
    let gathering: Era$<Evaluable<TestModel>>

    beforeEach(() => {
        spec$ = new Subject<EraSpec>();
        ripple$ = new Subject<TestRipple>();

        gathering = spec$.pipe(
                        startWith(0),
                        sliceByEra(ripple$),
                        evaluate(model))
                    .pipe(pullAllSlices());
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


    xit('gives nice error if strange log encountered', async () => {
        throw 'WIBBLE!';
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


    async function expectAggrs(expected: Slice<Dict<any>>[][]) {
        complete();

        const r = await gathering.pipe(
                        concatMapSlices(({logRefs, evaluate}) => 
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
                        concatMapSlices(({logRefs}) => 
                            logRefs.pipe(reduceToArray())),                            
                        materializeSlices()
                    ).toPromise();

        expect(r).toEqual(expected);
    }

})