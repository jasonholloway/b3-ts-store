import { Observable, OperatorFunction, pipe, of } from "rxjs";
import { EraWithSlices, scanUnwrapSlices } from "./slicer";
import { Keyed$ } from "./utils";
import { concatMap, defaultIfEmpty, filter, scan } from "rxjs/operators";
import { Model as LogModel } from './bits'

export type LogRef = string;

export type Model = {
    logs: { [ref: string]: LogModel<any, any> }
}


export type KnownLogs<M extends Model>
    = Extract<keyof M['logs'], string>

export type KnownAggr<M extends Model, K extends keyof M['logs']>
    = M['logs'][K]['zero']


export interface Evaluable<M extends Model> {
    data: Keyed$<any>
    logRefs: Observable<KnownLogs<M>>,
    evaluate<K extends KnownLogs<M>>(ref: K) : Observable<KnownAggr<M, K>>
}

function createEvaluable<M extends Model>(raw: Evaluable<M>) : Evaluable<M> {
    return raw;
}



export function evaluate<
    U, M extends Model, I extends EraWithSlices<Keyed$<U>>, O extends EraWithSlices<Evaluable<M>> & I>
    (model: M) : OperatorFunction<I, O>
{
    return pipe(
        scanUnwrapSlices(
            (prev$: Observable<Evaluable<M>>, curr$: Keyed$<U>) => of(
                createEvaluable({
                    data: curr$,
                    logRefs: curr$.pipe(
                                concatMap(g => isKnownLog(model, g.key) ? [g.key] : [])
                                ),
                    evaluate(ref) {
                        const m = model.logs[ref];

                        return prev$.pipe(
                            concatMap(prev => prev.evaluate(ref)),
                            defaultIfEmpty(m.zero),
                            concatMap(ac => curr$.pipe(
                                filter(g => g.key == ref),                  //filtering without a map is lame
                                concatMap(u$ => u$.pipe(scan(m.add, ac))))
                            ));
                    }
                })))
        );
}

function isKnownLog<M extends Model>(model: M, ref: string) : ref is KnownLogs<M> {
    return model.logs[ref] !== undefined;
}
