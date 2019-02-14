import { OperatorFunction, pipe, of, concat, from } from "rxjs";
import { Commit, Committed, CommitEvent } from "./committer";
import { concatMap, map, groupBy, reduce, flatMap, mapTo, catchError } from "rxjs/operators";
import { propsToArray, reduceToDict, tup, demux, packet } from "../utils";
import { Manifest } from "./signals";
import uuid from 'uuid/v1'
import { ManifestStore } from "./ManifestStore";
import { pullAll } from "./eraSlicer";
import { BlockStore } from "./BlockStore";

export const pusher =
    (blockStore: BlockStore, manifestStore: ManifestStore) : OperatorFunction<Commit, Commit> =>
    pipe(
        map(commit => ({
            ...commit,
            event$: 
                of(commit.data).pipe(
                    concatMap(data => {
                        const ref = uuid();
                        return blockStore.save(ref, data).pipe(
                                demux('Saved', mapTo(tup(ref, data))));
                    }),
                    concatMap(([blockRef, blockData]) => {
                        const oldLogBlock$ = from(propsToArray(commit.era.epoch.manifest.logBlocks));

                        const newLogBlock$ = from(propsToArray(blockData))
                                                .pipe(map(([k]) => tup(k, [blockRef])));

                        const merged$ = concat(oldLogBlock$, newLogBlock$).pipe(
                                            groupBy(([k]) => k),
                                            flatMap(g => g.pipe(
                                                reduce<[string, string[]], string[]>(
                                                    (ac, [, r]) => [...ac, ...r], []),
                                                map(r => tup(g.key, r)))),
                                            reduceToDict());

                        return merged$.pipe(
                                map(logBlocks => ({
                                    ...commit.era.epoch.manifest,
                                    version: commit.era.epoch.manifest.version + 1,
                                    logBlocks: logBlocks
                                })));
                    }),
                    concatMap(manifest =>
                        manifestStore.save(manifest).pipe(
                            demux('Gazumped', mapTo(gazumped())),
                            demux('Saved', mapTo(committed({ manifest, commit }))))),
                    catchError(err => of(packet('Error', err))),
                    pullAll())
        })));


function committed(o: { commit: Commit, manifest: Manifest}): CommitEvent {
    return ['Committed', o as Committed];
}

function gazumped(): CommitEvent {
    return ['Gazumped', {}];
}
