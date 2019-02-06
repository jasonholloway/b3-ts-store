import { Model } from "./evaluable";
import { Observable, OperatorFunction, Observer, empty } from "rxjs";
import { share, withLatestFrom, concatMap, map, mapTo, toArray, groupBy, concatAll, flatMap, filter } from "rxjs/operators";
import { reduceToDict, tup, Dict, propsToArray, log, logVal } from "../utils";
import { EvaluableEra } from "./evaluator";
import { Era } from "./eraSlicer";
import { RefreshEra, refreshEra } from "./signals";

export interface DoCommit {
    id: string
}

export interface Commit {
    id: string,
    era: Era
    data: Dict<any[]>
    extent: number,
    errors: Observable<Error>
}

//commits should concatMapped only after capturing the current era
//which is actually what happens: 
//
//a commit raised while another is ongoing should be ignored;
//unless it covers more slices than the other,
//in which case, 
//


export const committer =
    <M extends Model>
    (era$: Observable<EvaluableEra<M>>, refreshEra$: Observer<RefreshEra>) : OperatorFunction<DoCommit, Commit> =>
        doCommit$ => {
            const commit$ = doCommit$.pipe(
                                withLatestFrom(era$),
                                share());

            commit$.pipe(mapTo(refreshEra()))
                .subscribe(refreshEra$);
            
            return commit$.pipe(
                    concatMap(([{id}, era]) =>
                        era.slices.pipe(
                            concatMap(([, part$]) => part$),
                            groupBy(([ref]) => ref, ([, v$]) => v$),
                            flatMap(g$ => g$.pipe( 
                                            concatAll(),
                                            toArray(),
                                            map(r => tup(g$.key, r)))),
                            reduceToDict(),
                            logVal(`Committing era ${era.id}; manifest ${era.manifest.version}`),
                            filter(data => propsToArray(data).length > 0),
                            map(data => ({ 
                                id, 
                                data, 
                                extent: 1, 
                                era, 
                                errors: empty() 
                            })))),
                    share());
        };
