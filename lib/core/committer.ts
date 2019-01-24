import { Evaluable } from "./evaluateSlices";
import { Observable, OperatorFunction, Observer, pipe, empty } from "rxjs";
import { share, withLatestFrom, concatMap, take, map, mapTo } from "rxjs/operators";
import { EraWithSlices, Slice, Era, Ripple } from "./slicer";
import { RefreshEra, newEra } from "./specifier";
import { reduceToDict, reduceToArray, tup, Dict } from "../utils";

export type DoCommit = {}

export interface Commit {
    era: Era
    data: Dict<any[]>
    extent: number,
    errors: Observable<Error>
}

export const committer =
    (era$: Observable<EraWithSlices<[Ripple<any>, Evaluable]>  >, refreshEra$: Observer<RefreshEra>) : OperatorFunction<DoCommit, Commit> =>
        doCommit$ => {
            const c$ = doCommit$.pipe(
                        withLatestFrom(era$),
                        share());

            c$.pipe(mapTo(newEra()))
                .subscribe(refreshEra$);
            
            return c$.pipe(
                    concatMap(([_, era]) => 
                        era.slices.pipe(
                            take(1),
                            materialize(era))),
                    share());
        };
        

function materialize(era: Era) : OperatorFunction<Slice<[Ripple<any>, Evaluable]>, Commit> {
    return pipe(
        concatMap(([_, [data, evaluable]]) =>
            data.pipe(
                concatMap(([k, u$]) => 
                    u$.pipe(
                        reduceToArray(),
                        map(r => tup(k, r)))),             
                reduceToDict(),
                map(data => ({ data, extent: 1, era, errors: empty() }))
            ))
        );
}
