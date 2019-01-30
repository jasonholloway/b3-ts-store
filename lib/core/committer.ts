import { Model } from "./evaluable";
import { Observable, OperatorFunction, Observer, empty } from "rxjs";
import { share, withLatestFrom, concatMap, map, mapTo, toArray, groupBy, concatAll, flatMap, filter } from "rxjs/operators";
import { Era } from "./slicer";
import { RefreshEra, newEra } from "./specifier";
import { reduceToDict, tup, Dict, logVal, enumerate } from "../utils";
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
            const commit$ = doCommit$.pipe(
                                withLatestFrom(era$),
                                share());

            commit$.pipe(mapTo(newEra()))
                .subscribe(refreshEra$);
            
            return commit$.pipe(
                    concatMap(([, era]) =>
                        era.slices.pipe(
                            concatMap(([, part$]) => part$),
                            groupBy(([ref]) => ref, ([, v$]) => v$),
                            flatMap(g$ => g$.pipe( 
                                            concatAll(),
                                            toArray(),
                                            map(r => tup(g$.key, r)))),
                            reduceToDict(),
                            filter(data => enumerate(data).length > 0),
                            map(data => ({ data, extent: 1, era, errors: empty() })))),
                    share());
        };
