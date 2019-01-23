import { Evaluable, Model } from "./evaluate";
import { Observable, OperatorFunction, Observer, pipe, empty } from "rxjs";
import { share, withLatestFrom, concatMap, take, map, tap, mapTo, subscribeOn } from "rxjs/operators";
import { EraWithSlices, Slice, Era } from "./slicer";
import { RefreshEra, newEra } from "./specifier";
import { reduceToDict, reduceToArray, tup, Dict } from "./utils";

export type DoCommit = {}

export interface Commit {
    era: Era
    data: Dict<any[]>
    extent: number,
    errors: Observable<Error>
}

export const committer =
    <M extends Model, E extends EraWithSlices<Evaluable<M>>>
    (_: M, era$: Observable<E>, refreshEra$: Observer<RefreshEra>) : OperatorFunction<DoCommit, Commit> =>
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
        

function materialize<M extends Model>(era: Era) : OperatorFunction<Slice<Evaluable<M>>, Commit> {
    return pipe(
        concatMap(([_, {data}]) =>
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
