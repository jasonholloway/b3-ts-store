import { Observable, OperatorFunction, pipe, from, empty } from "rxjs";
import { LogRef } from "./evaluate";
import { BlockStore, Block } from "./bits";
import { map, concatMap, scan, concatAll } from "rxjs/operators";
import { Manifest } from "./specifier";
import { Dict } from "./utils";

export type BlockRef = string

export interface BlockFrame {
    blocks: Dict<Block>,

    load: (blockRef: BlockRef) => (logRef: LogRef) => Observable<any>
}

export const emptyBlocks: BlockFrame = { blocks: {}, load: () => () => empty() };


export const serveBlocks =
    (blockStore: BlockStore) : OperatorFunction<Manifest, BlockFrame> =>
        pipe(
            scan<Manifest, Observable<BlockFrame>>(
                (prev$, {logBlocks}) => 
                    prev$.pipe(
                        map(prev => ({
                            blocks: {},
                            load: (blockRef: BlockRef) => (logRef: LogRef) => 
                                    from(blockStore.load(blockRef))
                                        .pipe(concatMap(b => b[logRef] || empty()))
                        }))),
                empty()
            ),
            concatAll()
        );
