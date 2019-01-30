import { Observable } from "rxjs";
import { Model as LogModel } from '../bits'

export type LogRef = string;

export type Model = {
    logs: { [ref: string]: LogModel<any, any> }
}

export type KnownLogs<M extends Model>
    = Extract<keyof M['logs'], string>

export type KnownAggr<M extends Model, K extends keyof M['logs']>
    = M['logs'][K]['zero']


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
