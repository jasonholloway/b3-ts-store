import { Model, KnownLogs, KnownAggr } from "./evaluable";
import { Observable } from "rxjs";
import { concatMap } from "rxjs/operators";
import { EvaluableEra } from "./evaluator";
import { pullReplay } from "./eraSlicer";

export const createViewer =
    <M extends Model>
    (era$: Observable<EvaluableEra<M>>) : Viewer<M> => {
        era$ = era$.pipe(pullReplay(1));
        
        return (ref: KnownLogs<M>) =>
            era$.pipe(
                concatMap(({ evaluate }) => evaluate(ref)));
    }


export type Viewer<M extends Model> = 
    <K extends KnownLogs<M>>(ref: K) => Observable<KnownAggr<M, K>>
