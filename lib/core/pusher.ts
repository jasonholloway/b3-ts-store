import { BlockStore, ManifestStore } from "../bits";
import { OperatorFunction, pipe, of, Observable, MonoTypeOperatorFunction, concat, from } from "rxjs";
import { Commit, Committed, CommitEvent } from "./committer";
import { concatMap, mapTo, catchError, defaultIfEmpty, map, groupBy, reduce, flatMap } from "rxjs/operators";
import { propsToArray, reduceToDict, tup } from "../utils";
import { Manifest } from "./signals";
import uuid from 'uuid/v1'

export const pusher =
    (blockStore: BlockStore, manifestStore: ManifestStore) : OperatorFunction<Commit, Commit> =>
    pipe(
        concatMap(commit =>
            of(commit.data).pipe(
                concatMap(async data => {
                    const ref = uuid();
                    await blockStore.save(ref, data);
                    return tup(ref, data);
                }),
                concatMap(([blockRef, blockData]) => {
                    const oldLogBlock$ = from(propsToArray(commit.era.manifest.logBlocks));

                    const newLogBlock$ = from(propsToArray(blockData))
                                            .pipe(map(([k]) => tup(k, [blockRef])));

                    return concat(oldLogBlock$, newLogBlock$).pipe(
                            groupBy(([k]) => k),
                            flatMap(g => g.pipe(
                                reduce<[string, string[]], string[]>(
                                    (ac, [, r]) => [...ac, ...r], []),
                                map(r => tup(g.key, r)))),
                            reduceToDict());
                }),
                concatMap(mergedLogBlocks => {
                    const manifest: Manifest = {
                        ...commit.era.manifest,
                        version: commit.era.manifest.version + 1,
                        logBlocks: mergedLogBlocks
                    };

                    return manifestStore.save(manifest) //but the store also needs to return an etag for us to merge into the next manifest
                            .pipe(
                                defaultIfEmpty(), 
                                mapTo(manifest));
                }),
                map(manifest => ({ 
                    ...commit,
                    event$: concat(commit.event$, of(committed({ manifest, commit })))
                })),
                mergeErrorsInto(commit)
            ))
        );


function committed(o: { commit: Commit, manifest: Manifest}): CommitEvent {
    return ['Committed', o as Committed];
}

//on successful push of manifest,
//threshold needs to move forwards
//manifest needs to be updated
//this should be a single update also
//instead of just 'pullManifest'
//
//in fact, we don't want to allow any more commits 
//while we're messing with the manifest
//but at the same time, doCommits shouldn't be queued
//as they are only valid for the era for which they were summoned
//
//so doCommits should be let in via sentinel:
//only if no other commit is currently going through the motions
//otherwise the doCommit should be immediately dropped
//if we imagine a central /scan/ for controlling the commit process
//then, instead of simply appending on prev, there should be a kind of inverse
//switchMap

function mergeErrorsInto<F extends { error$: Observable<Error> }>(frame: F) : MonoTypeOperatorFunction<F> {
    return catchError(err =>
        of({
            ...frame as object,
            error$: concat(frame.error$, of(err))
        } as F));
}
