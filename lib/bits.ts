import { Dict, getOrSet, enumerate, tup } from "./utils";
import { LogBlocks, LogSpec } from "./LogSpace";
import { Manifest } from "./specifier";
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
    view(): Promise<V>;
}



export type Block = {
    [keys: string]: any[]
}

export interface BlockStore {
    load(key: string): Promise<Block>;
    save(key: string, block: Block): Promise<void>;
}



export interface ManifestStore {
    load(): Observable<Manifest>;
    save(manifest: Manifest): Observable<void>
}


export type Update<T extends string, V> = [number, T, V]
export type AnyUpdate = Update<string, any>

export type InferUpdateType<U> = U extends Update<infer UT, infer UB> ? UT : never;
export type InferUpdateBody<U> = U extends Update<infer UT, infer UB> ? UB : never;
