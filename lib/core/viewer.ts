import { Model, KnownLogs, KnownAggr } from "./evaluateSlices";
import { Observable } from "rxjs";
import { shareReplay, concatMap } from "rxjs/operators";
import { EvaluableEra } from "./evaluator";

export const createViewer =
    <M extends Model>
    (era$: Observable<EvaluableEra<M>>) : Viewer<M> => {
        era$ = era$.pipe(shareReplay(1));
        era$.subscribe();

        return (ref: KnownLogs<M>) =>
            era$.pipe(
                concatMap(({ evaluate }) => evaluate(ref)));
    }


export type Viewer<M extends Model> = 
    <K extends KnownLogs<M>>(ref: K) => Observable<KnownAggr<M, K>>
