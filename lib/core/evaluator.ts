import { pipe, OperatorFunction, empty, of } from "rxjs";
import { scan, concatMap, map, filter, defaultIfEmpty, startWith, single, distinct, takeLast, withLatestFrom } from "rxjs/operators";
import { Evaluable, Model, KnownLogs } from "./evaluable";
import { tup, concatScan, logVal } from "../utils";
import { Era, Ripple, Slice, emptyEra } from "./eraSlicer";


export interface EvaluableEra<M extends Model> 
    extends Era<Ripple>, Evaluable<M> { }


export const evaluator = 
    <M extends Model>(model: M) : OperatorFunction<Era<Ripple>, EvaluableEra<M>> => 
        pipe(
            concatScan((prev: EvaluableEra<M>, era: Era) =>
                of(createEvaluableEra<M>({
                    ...era,

                    logRef$: era.slices.pipe(
                                concatMap(([_, part$]) => part$),
                                concatMap(([ref]) => isKnownLog(model, ref) ? [ref] : []),
                                distinct()),

                    evaluate(ref) {
                        const m = model.logs[ref];

                        const blockView$ = era.blocks.evaluate(ref)         //if we could look at previous era here, we could check to see if we have to refetch...
                                                .pipe(single());

                        const oldView$ = blockView$.pipe(
                                            concatMap(blockView => 
                                                era.oldSlice$.pipe(
                                                    startWith(tup(era.thresh - 1, empty())),
                                                    concatScan((prev, [, part$]: Slice) =>
                                                        part$.pipe(
                                                            filter(([key]) => key == ref),
                                                            concatMap(([, v$]) => v$),
                                                            scan(m.add, prev),
                                                            defaultIfEmpty(prev),
                                                            takeLast(1)),
                                                        blockView),
                                                    takeLast(1))));
                        
                        const sliceId$ = era.currSlice$.pipe(
                                            map(([sliceId]) => sliceId),                                            
                                            startWith(era.from - 1));

                        return oldView$.pipe(
                                logVal('oldView'),
                                concatMap(oldView =>
                                    era.currSlice$.pipe(
                                        startWith(tup(era.from - 1, empty())),
                                        concatScan(([, prev]: [number, any], [sliceId, part$]: Slice) =>
                                            part$.pipe(                                                
                                                filter(([key]) => key == ref),
                                                concatMap(([, v$]) => v$),
                                                scan(m.add, prev),
                                                defaultIfEmpty(prev),
                                                takeLast(1),
                                                map(v => tup(sliceId, v))),
                                            tup(null, oldView)),
                                    )),
                                withLatestFrom(sliceId$),
                                filter(([[sliceId], latestSliceId]) => sliceId >= latestSliceId),
                                map(([[, v]]) => v));
                        }
                    })),
                null)
        );


function isKnownLog<M extends Model>(model: M, ref: string) : ref is KnownLogs<M> {
    return model.logs[ref] !== undefined;
}


function createEvaluableEra<M extends Model>(raw: EvaluableEra<M>) : EvaluableEra<M> {
    return raw;
}