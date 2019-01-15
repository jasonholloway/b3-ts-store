import { Dict, getOrSet, enumerate, tup } from "./utils";
import { LogBlocks, LogSpec } from "./LogSpace";

export function declareModel<U extends AnyUpdate, D, V>(m: Model<U, D, V>): Model<U, D, V> {
    return m;
}

export type Model<U, D, V = any> = {
    zero: D,
    add(data: D, update: U): D,
    // view(data: D): V
}


export interface Log<U extends AnyUpdate, V> {
    key: string,
    stage(update: U): void;
    view(): Promise<V>;
}



export type Block = {
    [keys: string]: AnyUpdate[]
}

export interface BlockStore {
    load(key: string): Promise<Block>;
    save(key: string, block: Block): Promise<void>;
}


export type Manifest = {
    version: number,
    logs: Dict<LogBlocks>
}


export interface ManifestStore {
    load(): Promise<Manifest>;
    save(manifest: Manifest): Promise<void>
}


export type Update<T extends string, V> = [number, T, V]
export type AnyUpdate = Update<string, any>

export type InferUpdateType<U> = U extends Update<infer UT, infer UB> ? UT : never;
export type InferUpdateBody<U> = U extends Update<infer UT, infer UB> ? UB : never;
