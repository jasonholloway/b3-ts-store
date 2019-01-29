import { Evaluable, Model } from "./evaluateSlices";
import { Observable, OperatorFunction, Observer, pipe, empty, MonoTypeOperatorFunction } from "rxjs";
import { share, withLatestFrom, concatMap, take, map, mapTo, reduce } from "rxjs/operators";
import { Slice, Era, Ripple } from "./slicer";
import { RefreshEra, newEra } from "./specifier";
import { reduceToDict, reduceToArray, tup, Dict } from "../utils";
import { EvaluableEra } from "./evaluator";

export type DoCommit = {}

export interface Commit {
    era: Era
    data: Dict<any[]>
    extent: number,
    errors: Observable<Error>
}

export const committer =
    <M extends Model>
    (era$: Observable<EvaluableEra<M>>, refreshEra$: Observer<RefreshEra>) : OperatorFunction<DoCommit, Commit> =>
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


function reduceIntoOne() : MonoTypeOperatorFunction<Slice<[Ripple<any>, Evaluable]>> {
    return pipe(
        reduce((ac, [ripple, evaluable]) => {
            throw 12345;
        })
    );
    

    //
    //
    //
}



function materialize(era: Era) : OperatorFunction<Slice<Ripple>, Commit> {
    return pipe(
        concatMap(([_, ripple]) =>
            ripple.pipe(
                concatMap(([k, u$]) => 
                    u$.pipe(
                        reduceToArray(),
                        map(r => tup(k, r)))),             
                reduceToDict(),
                map(data => ({ data, extent: 1, era, errors: empty() }))
            ))
        );
}
