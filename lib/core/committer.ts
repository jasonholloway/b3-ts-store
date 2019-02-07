import { Model } from "./evaluable";
import { Observable, OperatorFunction, concat, empty, pipe, merge } from "rxjs";
import { share, withLatestFrom, concatMap, map, toArray, groupBy, concatAll, flatMap, filter, exhaustMap, startWith, takeWhile } from "rxjs/operators";
import { reduceToDict, tup, Dict, propsToArray, scanToArray, skipAll } from "../utils";
import { EvaluableEra } from "./evaluator";
import { Era, Slice } from "./eraSlicer";
import { Manifest } from "./signals";

export interface DoCommit {
    id: string
}

export type Committed = { 
    commit: Commit,
    manifest: Manifest
}


export type CommitEvent = ['Error', Error] | ['Committed', Committed]

export interface Commit {
    id: string,
    era: Era
    data: Dict<any[]>
    extent: number,
    error$: Observable<Error>
    event$: Observable<CommitEvent>
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
                        filter(data => propsToArray(data).length > 0),      //if the slices are empty, then this will get trapped!!!
                        map(data => ({                                      //will end up waiting for confirmation that never comes,
                            id,                                             //as commit nevermade (rightfully)
                            data,
                            extent: 1,
                            era,
                            error$: empty(),
                            event$: empty()
                        })))
                )),
            share()
        );

//seems to me that each commit, even if skipped, should return some kind of result
//
//
