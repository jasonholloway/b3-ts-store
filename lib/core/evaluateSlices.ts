import { Observable, OperatorFunction, pipe, of, empty, concat, from } from "rxjs";
import { EraWithSlices, scanUnwrapSlices, pullAll, Ripple, Slice$, Era } from "./slicer";
import { concatMap, defaultIfEmpty, filter, scan, concatAll, map, tap } from "rxjs/operators";
import { Model as LogModel, BlockStore } from '../bits'
import { tup } from "../utils";

export type LogRef = string;

export type Model = {
    logs: { [ref: string]: LogModel<any, any> }
}


export type KnownLogs<M extends Model>
    = Extract<keyof M['logs'], string>

export type KnownAggr<M extends Model, K extends keyof M['logs']>
    = M['logs'][K]['zero']


export interface Evaluable<M extends Model = any> {
    logRef$: Observable<KnownLogs<M>>,
    evaluate<K extends KnownLogs<M>>(ref: K) : Observable<KnownAggr<M, K>>
}


function createEvaluable<M extends Model>(raw: Evaluable<M>) : Evaluable<M> {
    return raw;
}


export const evaluateSlices = 
    <M extends Model, U>
    (model: M) : OperatorFunction<EraWithSlices<Ripple<U>>, EraWithSlices<[Ripple<U>, Evaluable<M>]>> => 
        pipe(
            scanUnwrapSlices(
                (prev$: Observable<[Ripple<U>, Evaluable<M>]>, curr$: Ripple<U>, era: Era) => of(
                    tup(curr$,
                        createEvaluable<M>({

                            logRef$: curr$.pipe(
                                        concatMap(([key]) => isKnownLog(model, key) ? [key] : [])),

                            evaluate(ref) {
                                const m = model.logs[ref];

                                return prev$.pipe(
                                    map(([_, prev]) => prev.evaluate(ref)),
                                    
                                    defaultIfEmpty(of(m.zero)),

                                    // defaultIfEmpty( 
                                    //     loadFromBlocks(era, ref).pipe(
                                    //         scan(m.add, m.zero),
                                    //         defaultIfEmpty(m.zero))),

                                    concatAll(),

                                    concatMap(ac => curr$.pipe(
                                        filter(([key]) => key == ref),                  //filtering without a map is lame *****************
                                        concatMap(([_, u$]) => u$.pipe(scan(m.add, ac))))
                                    ));                                    
                            }

                        })) 
                ))
        );


// function loadFromBlocks(era: Era, logRef: string) : Observable<any> {
//     const blockRef$ = from(era.manifest.logBlocks[logRef] || []);
//     return blockRef$.pipe(
//             concatMap(blockRef => era.blocks.load(blockRef)(logRef)));
// }


function isKnownLog<M extends Model>(model: M, ref: string) : ref is KnownLogs<M> {
    return model.logs[ref] !== undefined;
}
