import { pipe, OperatorFunction, empty, Observable, of, concat } from "rxjs";
import { EraWithSlices, Ripple, pullAll } from "./slicer";
import { scan, concatAll, concatMap, map, filter, defaultIfEmpty, tap, shareReplay } from "rxjs/operators";
import { Evaluable, Model, KnownLogs } from "./evaluateSlices";
import { log } from "../utils";


export interface EvaluableEra<M extends Model> 
    extends EraWithSlices<Ripple>, Evaluable<M> { }


export const evaluator = 
    <M extends Model>(model: M) : OperatorFunction<EraWithSlices<Ripple>, EvaluableEra<M>> => 
        pipe(
            scan<EraWithSlices<Ripple>, Observable<EvaluableEra<M>>>(
                (prev$, era) => {

                    const logRef$ = era.slices.pipe(
                                        concatMap(([_, part$]) => part$),
                                        concatMap(([ref]) => isKnownLog(model, ref) ? [ref] : [])) ; //and unique?

                    const sliceId$ = era.slices.pipe(
                                        map(([[id]]) => id));   //for plucking out latest sliceId (default to threshold)

                    return of(createEvaluableEra<M>({
                        ...era,
                        logRef$,

                        evaluate(ref) {
                            const m = model.logs[ref];

                            const update$ = era.slices.pipe(
                                                concatMap(([, part$]) => 
                                                    part$.pipe(
                                                        filter(([key, v]) => key == ref),
                                                        concatMap(([, v$]) => v$))));
                            
                            const blockEval$ = era.blocks
                                                .evaluate(ref)
                                                .pipe(shareReplay(1));
                                            
                            return concat(
                                    blockEval$, 
                                    update$.pipe(
                                        scan<any, Observable<any>>(
                                            (ac$, v) => 
                                                ac$.pipe(map(ac => m.add(ac, v))),
                                            blockEval$
                                                .pipe(defaultIfEmpty(m.zero))),
                                        concatAll())
                                    );
                        }
                    }));
                },
                empty()),
            concatAll()
        );



function isKnownLog<M extends Model>(model: M, ref: string) : ref is KnownLogs<M> {
    return model.logs[ref] !== undefined;
}


function createEvaluableEra<M extends Model>(raw: EvaluableEra<M>) : EvaluableEra<M> {
    return raw;
}