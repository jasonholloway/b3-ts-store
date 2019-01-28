import { Model, Evaluable, KnownLogs, KnownAggr } from "./evaluateSlices";
import { OperatorFunction, pipe, empty, from, of, Observable } from "rxjs";
import { BlockFrame } from "./pullBlocks";
import { map, concatMap, scan } from "rxjs/operators";
import { log } from "../utils";



export const evaluateBlocks = 
    <M extends Model>(model: M) : OperatorFunction<BlockFrame, Evaluable<M>> =>
    pipe(
        map(({manifest, load}) => {

            return {
                logRef$: empty(),

                evaluate<K extends KnownLogs<M>>(logRef: K): Observable<KnownAggr<M, K>> {
                    const m = model.logs[logRef];

                    return from(manifest.logBlocks[logRef] || [])
                            .pipe(
                                concatMap(blockRef => load(blockRef)(logRef)),
                                scan(m.add, m.zero));
                }
            }
        })
    );
        
