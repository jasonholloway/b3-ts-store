import { BlockStore, ManifestStore } from "../bits";
import { Observer, OperatorFunction, pipe, of, Observable, MonoTypeOperatorFunction, concat, from } from "rxjs";
import { Commit } from "./committer";
import { concatMap, tap, mapTo, catchError, defaultIfEmpty, map, groupBy, reduce } from "rxjs/operators";
import { enumerate, log, reduceToDict, tup, logVal } from "../utils";
import { Manifest } from "./signals";
import { PullManifest, pullManifest } from "./pullManifests";
import uuid from 'uuid/v1'

export const pusher =
    (blockStore: BlockStore, manifestStore: ManifestStore, pull$: Observer<PullManifest>) : OperatorFunction<Commit, Commit> =>
    pipe(
        concatMap(commit =>
            of(commit.data).pipe(
                concatMap(async data => {
                    const ref = uuid();
                    await blockStore.save(ref, data);
                    return tup(ref, data);
                }),
                concatMap(([blockRef, blockData]) => {
                    const oldLogBlock$ = from(enumerate(commit.era.manifest.logBlocks));

                    const newLogBlock$ = from(enumerate(blockData))
                                            .pipe(map(([k]) => tup(k, [blockRef])));

                    return concat(oldLogBlock$, newLogBlock$).pipe(
                            groupBy(([k]) => k),
                            concatMap(g => g.pipe(
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
                            .pipe(defaultIfEmpty());
                }),
                mapTo(commit),
                mergeErrorsInto(commit),
                tap(() => pull$.next(pullManifest()))
            ))
        );


function mergeErrorsInto<F extends { errors: Observable<Error> }>(frame: F) : MonoTypeOperatorFunction<F> {
    return catchError(err => 
        of({ 
            ...frame as object,
            errors: concat(frame.errors, of(err)) 
        } as F));
}
