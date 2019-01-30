import { pipe, OperatorFunction, empty, Observable, of } from "rxjs";
import { EraWithSlices, Ripple, Slice } from "./slicer";
import { scan, concatAll, concatMap, map, filter, defaultIfEmpty, startWith, single, last, distinct, takeLast, withLatestFrom } from "rxjs/operators";
import { Evaluable, Model, KnownLogs } from "./evaluable";
import { tup } from "../utils";


export interface EvaluableEra<M extends Model> 
    extends EraWithSlices<Ripple>, Evaluable<M> { }


export const evaluator = 
    <M extends Model>(model: M) : OperatorFunction<EraWithSlices<Ripple>, EvaluableEra<M>> => 
        pipe(
            scan<EraWithSlices<Ripple>, Observable<EvaluableEra<M>>>(
                (prev$, era) => of(createEvaluableEra<M>({
                    ...era,

                    logRef$: era.slices.pipe(
                                concatMap(([_, part$]) => part$),
                                concatMap(([ref]) => isKnownLog(model, ref) ? [ref] : []),
                                distinct()),

                    evaluate(ref) {
                        const m = model.logs[ref];
                        
                        const blockView$ = era.blocks.evaluate(ref)
                                                .pipe(single());

                        const oldView$ = blockView$.pipe(
                                            concatMap(blockView => 
                                                era.oldSlice$.pipe(
                                                    scan<Slice, Observable<any>>(
                                                        (prev$, [, part$]) => 
                                                            prev$.pipe(
                                                                concatMap(prev => 
                                                                    part$.pipe(
                                                                        filter(([key]) => key == ref),
                                                                        concatMap(([, v$]) => v$),
                                                                        scan(m.add, prev),
                                                                        last()))),
                                                        of(blockView)),
                                                    concatAll(),
                                                    takeLast(1),
                                                    defaultIfEmpty(blockView))
                                                ));
                        
                        const sliceId$ = era.currSlice$.pipe(
                                            map(([sliceId]) => sliceId),
                                            startWith(era.from - 1));

                        return oldView$.pipe(
                                concatMap(oldView =>
                                    era.currSlice$.pipe(
                                        scan<Slice, Observable<[number, any]>>(
                                            (prev$, [sliceId, part$]) => 
                                                prev$.pipe(
                                                    concatMap(([, prev]) => part$.pipe(
                                                        filter(([key]) => key == ref),
                                                        concatMap(([, v$]) => v$),
                                                        scan(m.add, prev),
                                                        last())),
                                                    map(v => tup(sliceId, v))
                                                ),
                                            of(tup(era.from - 1, oldView))),
                                        concatAll(),
                                        startWith(tup(era.from - 1, oldView))
                                    )),
                                withLatestFrom(sliceId$),
                                filter(([[sliceId], latestSliceId]) => sliceId >= latestSliceId),
                                map(([[, v]]) => v));
                        }
                    })),
                empty()),
            concatAll()
        );


function isKnownLog<M extends Model>(model: M, ref: string) : ref is KnownLogs<M> {
    return model.logs[ref] !== undefined;
}


function createEvaluableEra<M extends Model>(raw: EvaluableEra<M>) : EvaluableEra<M> {
    return raw;
}