import { Model } from "./evaluable";
import { Observable, OperatorFunction, Observer, concat, empty, pipe, of, from, fromEvent, fromEventPattern, forkJoin, merge, UnaryFunction } from "rxjs";
import { share, withLatestFrom, concatMap, map, mapTo, toArray, groupBy, concatAll, flatMap, filter, scan, exhaustMap, tap, sample, startWith, takeUntil, takeWhile, skipWhile, mergeScan, endWith, switchMapTo } from "rxjs/operators";
import { reduceToDict, tup, Dict, propsToArray, log, logVal, scanToArray, skipAll } from "../utils";
import { EvaluableEra } from "./evaluator";
import { Era, Slice } from "./eraSlicer";
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


//yarp - the problem we have isn't a bug, but a blindspot
//
//for commits to work, there can only be one at a time
//the slice threshold is only moved forwards when a commit completes (if even then)
//
//exhaustMap is the thing; if a current commit is ongoing,
//then we must drop the incoming doCommit
//(but because everything will now have to be in a scan, the pushing must be nested inside)
//
//instead of just swallowing the incoming commit, it'd be nice to say that the commit had been ignored



//**************************************** */
//QUESTION
//Don't we have to exhaustMap over the pushing too?
//we surely doooooo...
//
//hmmm, the problem before was that committed slices were making it into the follow on 'committing' era
//so the manifest version was incrementing etc, but staging wasn't...hmm
//
//we shouldn't be able to commit again until staging /has updated/ following the previous commit
//...


const trackSlices =
    pipe(
        concatMap((era: Era) =>
            era.currSlice$.pipe(
                scanToArray(),
                startWith([] as Slice[]),
                map(currSlices => ({
                    era,
                    slice$: concat(era.oldSlice$, currSlices)
                }) 
            )))
    );


export const committer =
    <M extends Model>
    (era$: Observable<EvaluableEra<M>>) : OperatorFunction<DoCommit, Commit> =>
        pipe(
            withLatestFrom(trackSlices(era$)),                                       //this should really get head and remainder, so we can attach to it below
            exhaustMap(([{id}, {era, slice$}]) =>
                merge(
                    era$.pipe(                                                      //will complete when our commit has made it into era - opening up more commits!
                        takeWhile(era => era.manifest.version != 9),
                        skipAll()),
                    slice$.pipe(
                        concatMap(([, part$]) => part$),
                        groupBy(([ref]) => ref, ([, v$]) => v$),
                        flatMap(g$ => g$.pipe( 
                                        concatAll(),
                                        toArray(),
                                        map(r => tup(g$.key, r)))),                                            
                        reduceToDict(),
                        filter(data => propsToArray(data).length > 0),
                        map(data => ({ 
                            id, 
                            data, 
                            extent: 1, 
                            era, 
                            errors: empty() 
                        })))
                )),
            share()
        );
