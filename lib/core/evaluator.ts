import { pipe, OperatorFunction, empty, Observable, of } from "rxjs";
import { EraWithSlices, Ripple } from "./slicer";
import { scan, concatAll, concatMap, map, filter, defaultIfEmpty } from "rxjs/operators";
import { Evaluable, Model, KnownLogs } from "./evaluateSlices";


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
                            
                            const base$ = era.blocks
                                            .evaluate(ref).pipe(
                                                defaultIfEmpty(m.zero))

                            return update$.pipe(
                                    scan<any, Observable<any>>(
                                        (ac$, v) => 
                                            ac$.pipe(map(ac => m.add(ac, v))),
                                        base$),
                                    concatAll());
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