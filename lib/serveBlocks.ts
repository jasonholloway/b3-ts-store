import { Observable, OperatorFunction, pipe, from, of, empty, Observer } from "rxjs";
import { LogRef } from "./evaluate";
import { BlockStore } from "./bits";
import { map, concatMap, catchError, tap } from "rxjs/operators";
import { EraWithSpec } from "./specifier";
import { EraWithErrors } from "./sinkErrors";

export type BlockRef = string
   

export interface EraWithBlocks { 
    blocks: BlockFrame
}

export interface BlockFrame {
    load: (blockRef: BlockRef) => (logRef: LogRef) => Observable<any>
}

export const serveBlocks =
    <I extends EraWithSpec & EraWithErrors, O extends EraWithBlocks & I>
    (blockStore: BlockStore) : OperatorFunction<I, O> =>
        pipe(
            map(era => ({
                ...era as object, 
                blocks: {
                    load: (blockRef: BlockRef) => (logRef: LogRef) =>
                            from(blockStore.load(blockRef))                            
                                .pipe(
                                    divertErrors(era.errors, of({})),                  //but if this defaulting to serving nothing
                                    concatMap(b => b[logRef] || empty()))              //that'd then mean big chunks of data would be lost

                } as BlockFrame
            } as O))
        );

export const divertErrors = 
    <V>(error$: Observer<Error>, fallback: Observable<V> = empty()) =>
        error$ !== undefined
            ? catchError<V, V>(err => {
                error$.next(err);
                return fallback;
            }) 
            : pipe() as OperatorFunction<V, V>;
