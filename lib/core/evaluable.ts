import { Observable, empty } from "rxjs";
import { Model, KnownLogs, KnownAggr } from "../model";

export type LogRef = string;

export interface Evaluable<M extends Model = any> {
    logRef$: Observable<KnownLogs<M>>,
    evaluate<K extends KnownLogs<M>>(ref: K) : Observable<KnownAggr<M, K>>
}

export function createEvaluable<M extends Model>(raw: Evaluable<M>) : Evaluable<M> {
    return raw;
}

export function isKnownLog<M extends Model>(model: M, ref: string) : ref is KnownLogs<M> {
    return model.logs[ref] !== undefined;
}

export const emptyEvaluable: Evaluable = {
    logRef$: empty(),
    evaluate: () => empty()
}
