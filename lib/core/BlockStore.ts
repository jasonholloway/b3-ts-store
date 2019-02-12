import { Observable } from "rxjs";
import { Block } from "../bits";

export namespace BlockStore {
    export type LoadResponse = ['Loaded', Block]
    export type SaveResponse = ['Saved', {}]
}


export interface BlockStore {
    load(key: string): Observable<BlockStore.LoadResponse>;
    save(key: string, block: Block): Observable<BlockStore.SaveResponse>;
}
