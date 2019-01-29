import { pipe, OperatorFunction, empty, Observable, of, concat } from "rxjs";
import { EraWithSlices, Ripple, pullAll, Slice } from "./slicer";
import { scan, concatAll, concatMap, map, filter, defaultIfEmpty, tap, shareReplay, startWith, single, last } from "rxjs/operators";
import { Evaluable, Model, KnownLogs } from "./evaluateSlices";
import { log, tup } from "../utils";


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
                                                map(([[id]]) => id),

                                                );   //for plucking out latest sliceId (default to from)

                    //so... evaluate will be called when attaching to a new era
                    //at this point we should only emit actual views from /from/ or onwards
                    //or, if we have no views, we should emit the base view from block storage
                    //
                    //

                    return of(createEvaluableEra<M>({
                        ...era,
                        logRef$,

                        evaluate(ref) {
                            const m = model.logs[ref];
                            
                            const base$ = era.blocks
                                            .evaluate(ref).pipe(
                                                single(),
                                                map(v => tup(era.thresh, v)),
                                                shareReplay(1));

                            return base$.pipe(
                                    concatMap(base =>                                               
                                        era.slices.pipe(
                                            scan<Slice, Observable<[number, any]>>(
                                                (prev$, [[i], part$]) => 
                                                    prev$.pipe(
                                                        concatMap(([, prev]) => part$.pipe(
                                                            filter(([key]) => key == ref),
                                                            concatMap(([, v$]) => v$),
                                                            scan(m.add, prev),
                                                            last())),
                                                        map(v => tup(i, v))
                                                    ),
                                                of(base)),
                                            concatAll(),
                                            filter(([i]) => i >= era.from),
                                            defaultIfEmpty(base))),             //this isn't what we should be defaulting to!
                                    map(([, v]) => v));                         //really we want to partition here
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