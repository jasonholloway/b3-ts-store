import { Observer, Observable, OperatorFunction, pipe, from, of, empty } from "rxjs";
import { LogRef } from "./evaluate";
import { EraWithThresh } from "./slicer";
import { BlockStore } from "./bits";
import { map, concatMap, catchError } from "rxjs/operators";

export type BlockRef = string
   
export interface EraWithErrors {
    errors: Observer<Error>
}


export interface EraWithBlocks { 
    blocks: BlockFrame
}

export interface BlockFrame {
    load: (blockRef: BlockRef) => (logRef: LogRef) => Observable<any>
}

export const serveBlocks =
    <I extends EraWithThresh & EraWithErrors, O extends EraWithBlocks & I>
    (blockStore: BlockStore) : OperatorFunction<I, O> => {
    return pipe(
        map(era => ({
            ...era as object, 
            blocks: {
                load: (blockRef: BlockRef) => (logRef: LogRef) =>
                        from(blockStore.load(blockRef))                            
                            .pipe(
                                divertErrors(era, of({})),                  //but if this defaulting to serving nothing
                                concatMap(b => b[logRef] || empty()))       //that'd then mean big chunks of data would be lost

            } as BlockFrame
        } as O))
    );
}


export function divertErrors<V>(era: EraWithErrors, fallback: Observable<V> = empty()) {
    return catchError(err => {
        era.errors.next(err);
        return fallback;
    });
}

