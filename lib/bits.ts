import { Observable } from "rxjs";

export function declareLogModel<U extends AnyUpdate, D>(m: Model<U, D>): Model<U, D> {
    return m;
}

export type Model<U, D> = {
    zero: D,
    add(data: D, update: U): D
}


export interface Log<U extends AnyUpdate, V> {
    key: string,
    stage(update: U): void;
    view(): Observable<V>;
}


export type Block = {
    [keys: string]: any[]
}


export type Update<T extends string, V> = [number, T, V]
export type AnyUpdate = Update<string, any>

export type InferUpdateType<U> = U extends Update<infer UT, infer UB> ? UT : never;
export type InferUpdateBody<U> = U extends Update<infer UT, infer UB> ? UB : never;
