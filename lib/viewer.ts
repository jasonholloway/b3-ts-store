import { Model, KnownLogs, KnownAggr, Evaluable } from "./evaluate";
import { Observable } from "rxjs";
import { shareReplay, concatMap, debounceTime } from "rxjs/operators";
import { EraWithSlices } from "./slicer";

export type Viewer<M extends Model> =
        <K extends KnownLogs<M>>(ref: K) => Observable<KnownAggr<M, K>>

export type ViewableEra<M extends Model> = EraWithSlices<Evaluable<M>>


export function createViewer<M extends Model>(era$: Observable<EraWithSlices<Evaluable<M>>>) : Viewer<M> {
    era$ = era$.pipe(shareReplay(1));
    era$.subscribe();

    return (ref: KnownLogs<M>) =>
        era$.pipe(
            concatMap(({ slices }) =>
                slices.pipe(
                    concatMap(([_, {evaluate}]) => evaluate(ref))
                    )),
            debounceTime(1) //something of a bodge: ultimately, epoch-number + slice-number + last era command = means of doing this deterministically
            );
}
