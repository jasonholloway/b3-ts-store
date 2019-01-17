import { Observable, OperatorFunction, pipe, empty } from "rxjs";
import { Era, scanSlices } from "./sliceByEra";
import { Keyed$ } from "./utils";
import { concatMap, defaultIfEmpty, flatMap, filter, scan } from "rxjs/operators";
import { Model as LogModel } from './bits'

export type LogRef = string;

export type Era$<V> = Observable<Era<V>>


export type Model = {
    logs: { [ref: string]: LogModel<any, any> }
}


export type KnownLogs<M extends Model>
    = Extract<keyof M['logs'], string>

export type KnownAggr<M extends Model, K extends keyof M['logs']>
    = M['logs'][K]['zero']


export type Evaluable<M extends Model> = {
    data: Keyed$<any>
    logRefs: Observable<KnownLogs<M>>,
    evaluate<K extends KnownLogs<M>>(ref: K) : Observable<KnownAggr<M, K>>
}

const emptyEvaluable = { data: empty(), logRefs: empty(), evaluate: () => empty() }


export function evaluate<U, M extends Model>(model: M) : OperatorFunction<Era<Keyed$<U>>, Era<Evaluable<M>>> {
    return pipe(
        scanSlices<Keyed$<U>, Evaluable<M>>(
            (prev, curr$) => ({
                data: curr$,
                logRefs: curr$.pipe(
                            concatMap(g => isKnownLog(model, g.key) ? [g.key] : [])
                            ),
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
            emptyEvaluable));
}

function isKnownLog<M extends Model>(model: M, ref: string) : ref is KnownLogs<M> {
    return model.logs[ref] !== undefined;
}
