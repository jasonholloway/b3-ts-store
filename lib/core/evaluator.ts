import { pipe, OperatorFunction, empty, Observable, of, concat } from "rxjs";
import { EraWithSlices, Ripple, pullAll, Slice } from "./slicer";
import { scan, concatAll, concatMap, map, filter, defaultIfEmpty, tap, shareReplay, startWith, single, last, takeWhile, skipWhile, partition, distinct, takeLast, withLatestFrom, delay } from "rxjs/operators";
import { Evaluable, Model, KnownLogs } from "./evaluateSlices";
import { log, tup, logVal } from "../utils";


export interface EvaluableEra<M extends Model> 
    extends EraWithSlices<Ripple>, Evaluable<M> { }


export const evaluator = 
    <M extends Model>(model: M) : OperatorFunction<EraWithSlices<Ripple>, EvaluableEra<M>> => 
        pipe(
            scan<EraWithSlices<Ripple>, Observable<EvaluableEra<M>>>(
                (prev$, era) => {                    
                    const logRef$ = era.slices.pipe(
                                        concatMap(([_, part$]) => part$),
                                        concatMap(([ref]) => isKnownLog(model, ref) ? [ref] : []),
                                        distinct());

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
                            
                            const base$ = era.blocks.evaluate(ref)
                                            .pipe(single());

                            const oldSlices = era.slices.pipe(
                                                takeWhile(([[i]]) => i < era.from));

                            const base2$ = base$.pipe(
                                            log('blockBase'),
                                            concatMap(base => 
                                                oldSlices.pipe(
                                                    tap({ complete: () => console.log('oldSlices complete') }),
                                                    scan<Slice, Observable<any>>(
                                                        (prev$, [, part$]) => 
                                                            prev$.pipe(
                                                                concatMap(prev => 
                                                                    part$.pipe(
                                                                        filter(([key]) => key == ref),
                                                                        concatMap(([, v$]) => v$),
                                                                        scan(m.add, prev),
                                                                        last()))),
                                                        of(base)),
                                                    concatAll(),
                                                    takeLast(1),            
                                                    defaultIfEmpty(base))   
                                                ));
                            
                            const mySlices = era.slices.pipe(
                                                skipWhile(([[i]]) => i < era.from));

                            const sliceId$ = mySlices.pipe(
                                                // delay(50),
                                                map(([[i]]) => i),
                                                startWith(era.from - 1));

                            return base2$.pipe(
                                    log('base'),
                                    concatMap(base =>                                               
                                        mySlices.pipe(
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
                                                of(tup(era.from - 1, base))),
                                            concatAll(),
                                            startWith(tup(era.from - 1, base))
                                        )),                                   
                                    logVal('slice'), 
                                    withLatestFrom(sliceId$.pipe(logVal('sliceId'))),
                                    filter(([[sliceId], latestSliceId]) => sliceId >= latestSliceId), //instead of filtering from, should filter to only allow latest slice through...
                                    map(([[, v]]) => v));

                                //it's a race condition, as a delay on sliceIds solces it...
                                //
                                //for each slice, the sliceId goes up before the slice gets evaluated
                                //the slice is created, 
                                //
                                //well,the input slicesare blitzed through
                                //it's not a delay that's needed in setting up the view,
                                //as for the view to doanything itself, a slice needs to have been emitted in the first place
                                //
                                //so, the question is - what happens when a slice is emitted?
                                //
                                //
                                //how can it prefilter /before/ there's a slice? because the concatMAp very reasonably emits its base as soon as possible
                                //
                                //and, that's the rub: the processing of slices is done only after the completionf of base$
                                //this is quite involved, 
                                //

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