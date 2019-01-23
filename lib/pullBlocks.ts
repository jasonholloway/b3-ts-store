import { Observable, OperatorFunction, pipe, from, empty } from "rxjs";
import { LogRef } from "./evaluateSlices";
import { BlockStore, Block } from "./bits";
import { map, concatMap, scan, concatAll, defaultIfEmpty } from "rxjs/operators";
import { Manifest } from "./specifier";
import { Dict, log } from "./utils";

export type BlockRef = string

export interface BlockFrame {
    load: (blockRef: BlockRef) => (logRef: LogRef) => Observable<any>
}

interface InnerBlockFrame extends BlockFrame {
    data: Dict<Block>
}


export const emptyBlocks: BlockFrame = { load: () => () => empty() };


export const pullBlocks =
    (blockStore: BlockStore) : OperatorFunction<Manifest, BlockFrame> =>
        pipe(
            scan<Manifest, Observable<InnerBlockFrame>>(
                (prev$, {logBlocks}) => 
                    prev$.pipe(
                        defaultIfEmpty({}),
                        map(prev => ({
                            data: {},
                            load: (blockRef: BlockRef) => (logRef: LogRef) =>
                                    from(blockStore.load(blockRef))
                                        .pipe(concatMap(b => b[logRef] || empty()))
                        }))),
                empty()
            ),
            concatAll()
        );
