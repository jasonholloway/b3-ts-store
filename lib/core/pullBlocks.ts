import { Observable, OperatorFunction, pipe, from, empty } from "rxjs";
import { LogRef } from "./evaluable";
import { BlockStore, Block } from "../bits";
import { map, concatMap, scan, concatAll, defaultIfEmpty } from "rxjs/operators";
import { Manifest, emptyManifest } from "./specifier";
import { Dict, log } from "../utils";

export type BlockRef = string

export interface BlockFrame {
    load: (blockRef: BlockRef) => (logRef: LogRef) => Observable<any>,
    manifest: Manifest
}

interface InnerBlockFrame extends BlockFrame {
    data: Dict<Block>
}


export const emptyBlocks: BlockFrame = { 
    load: () => () => empty(),
    manifest: emptyManifest
};


export const pullBlocks =
    (blockStore: BlockStore) : OperatorFunction<Manifest, BlockFrame> =>
        pipe(
            scan<Manifest, Observable<InnerBlockFrame>>(
                (prev$, manifest) => 
                    prev$.pipe(
                        defaultIfEmpty({}),
                        map(prev => ({
                            data: {},
                            manifest, 
                            load: (blockRef: BlockRef) => (logRef: LogRef) =>
                                    from(blockStore.load(blockRef))
                                        .pipe(concatMap(b => b[logRef] || empty()))
                        }))),
                empty()
            ),
            concatAll()
        );
