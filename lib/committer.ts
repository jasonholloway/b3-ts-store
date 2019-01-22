import { Evaluable, Model } from "./evaluate";
import { Observable, OperatorFunction, Observer, pipe, empty } from "rxjs";
import { share, withLatestFrom, concatMap, take, map } from "rxjs/operators";
import { EraWithSlices, Slice } from "./slicer";
import { RefreshEra, EraWithSpec } from "./specifier";
import { reduceToDict, reduceToArray, tup, Dict } from "./utils";

export type DoCommit = {}

export interface Commit {
    era: EraWithSpec
    data: Dict<any[]>
    extent: number,
    errors: Observable<Error>
}

export const committer =
    <M extends Model, E extends EraWithSpec & EraWithSlices<Evaluable<M>>>
    (_: M, era$: Observable<E>, refreshEra$: Observer<RefreshEra>) : OperatorFunction<DoCommit, Commit> =>
        pipe(
            withLatestFrom(era$),
            concatMap(([_, era]) => 
                era.slices.pipe(
                    take(1),
                    materialize(era))),
            share());

        // doStore$
        //     .pipe(mapTo(newEra()))
        //     .subscribe(refreshEra$);
        //ABOVE NEEDS REINSTATING! ***************************
        //but it'd be good to show its absence with a test...


function materialize<M extends Model>(era: EraWithSpec) : OperatorFunction<Slice<Evaluable<M>>, Commit> {
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
