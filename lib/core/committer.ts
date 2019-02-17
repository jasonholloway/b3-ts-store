import { Observable, OperatorFunction, concat, empty, pipe, merge } from "rxjs";
import { share, withLatestFrom, concatMap, map, toArray, groupBy, concatAll, flatMap, filter, exhaustMap, startWith, takeWhile, zip, count } from "rxjs/operators";
import { reduceToDict, tup, Dict, propsToArray, scanToArray, skipAll } from "../utils";
import { EvaluableEra } from "./evaluator";
import { Era, Slice } from "./eraSlicer";
import { Manifest } from "./signals";
import { pusher } from "./pusher";
import { ManifestStore } from "./ManifestStore";
import { BlockStore } from "./BlockStore";
import { Model } from "../model";

export interface DoCommit {
    id: string
}

export type Committed = { 
    commit: Commit,
    manifest: Manifest
}


export type CommitEvent = ['Error', any] | ['Committed', Committed] | ['Gazumped', {}]

export interface Commit {
    id: string,
    era: Era
    data: Dict<any[]>
    range: [number, number],
    event$: Observable<CommitEvent>
}


const trackSlices =
    pipe(
        concatMap((era: Era) =>
            era.currSlice$.pipe(
                scanToArray(),
                startWith([] as Slice[]),
                map(currSlices => 
                    ({ era, slice$: concat(era.oldSlice$, currSlices) })
            )))
    );


export const committer =
    <M extends Model>
    (era$: Observable<EvaluableEra<M>>, blockStore: BlockStore, manifestStore: ManifestStore) : OperatorFunction<DoCommit, Commit> =>
        pipe(
            withLatestFrom(trackSlices(era$)),                                       //this should really get head and remainder, so we can attach to it below
            exhaustMap(([{id}, {era, slice$}]) =>
                merge(
                    era$.pipe(                                                      //will complete when our commit has made it into era - opening up more commits!
                        map(e => e.epoch.commit),                        
                        takeWhile(cm => !cm || cm.id !== id),
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

                        zip(slice$.pipe(count())),                        
                        map(([data, sliceCount]) => ({                                      //will end up waiting for confirmation that never comes,
                            id,                                             //as commit nevermade (rightfully)
                            data,
                            range: tup(era.thresh, sliceCount),
                            era,
                            event$: empty()
                        })),                        

                        pusher(blockStore, manifestStore))
                )),
            share()
        );

//2 error responses:
//- pullnew manifest
//- exhaust commit


//seems to me that each commit, even if skipped, should return some kind of result
//
//
