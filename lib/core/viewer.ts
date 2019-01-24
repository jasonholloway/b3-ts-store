import { Model, KnownLogs, KnownAggr, Evaluable } from "./evaluateSlices";
import { Observable, of, concat } from "rxjs";
import { shareReplay, concatMap, debounceTime, map } from "rxjs/operators";
import { EraWithSlices } from "./slicer";

export const createViewer =
    <M extends Model>
    (era$: Observable<EraWithSlices<Evaluable<M>>>) : Viewer<M> => {
        era$ = era$.pipe(shareReplay(1));
        era$.subscribe();

        return (ref: KnownLogs<M>) =>
            era$.pipe(
                concatMap(({ blocks, slices }) =>
                    concat(
                        of(blocks as Evaluable<M>),
                        slices.pipe(map(([_, ev]) => ev)))
                    .pipe(
                        concatMap(({evaluate}) => evaluate(ref))
                    )),
                debounceTime(1) //something of a bodge: ultimately, epoch-number + slice-number + last era command = means of doing this deterministically
                );
    }


export type Viewer<M extends Model> = 
    <K extends KnownLogs<M>>(ref: K) => Observable<KnownAggr<M, K>>
