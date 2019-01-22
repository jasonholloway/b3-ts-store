import { Observable, OperatorFunction, pipe, from, empty } from "rxjs";
import { LogRef } from "./evaluate";
import { BlockStore } from "./bits";
import { map, concatMap } from "rxjs/operators";
import { EraWithSpec } from "./specifier";

export type BlockRef = string
   

export interface EraWithBlocks { 
    blocks: BlockFrame
}

export interface BlockFrame {
    load: (blockRef: BlockRef) => (logRef: LogRef) => Observable<any>
}

export const serveBlocks =
    <I extends EraWithSpec, O extends EraWithBlocks & I>
    (blockStore: BlockStore) : OperatorFunction<I, O> =>
        pipe(
            map(era => ({
                ...era as object, 
                blocks: {
                    load: (blockRef: BlockRef) => (logRef: LogRef) =>
                            from(blockStore.load(blockRef))                            
                                .pipe(concatMap(b => b[logRef] || empty()))

                } as BlockFrame
            } as O))
        );
        