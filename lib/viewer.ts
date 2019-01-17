import { Model, KnownLogs, KnownAggr, Era$, Evaluable } from "./evaluate";
import { Observable } from "rxjs";
import { shareReplay, concatMap, debounceTime } from "rxjs/operators";

export type Viewer<M extends Model> =
        <K extends KnownLogs<M>>(ref: K) => Observable<KnownAggr<M, K>>


export function createViewer<M extends Model>(era$: Era$<Evaluable<M>>) : Viewer<M> {
    era$ = era$.pipe(shareReplay(1));
    era$.subscribe();

    return (ref: KnownLogs<M>) =>
        era$.pipe(
            concatMap(([_, slices]) =>
                slices.pipe(
                    concatMap(([_, {evaluate}]) => evaluate(ref))
                    )),
            debounceTime(1) //something of a bodge: ultimately, epoch-number + slice-number + last era command = means of doing this deterministically
            );
}
