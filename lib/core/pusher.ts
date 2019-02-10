import { BlockStore } from "../bits";
import { OperatorFunction, pipe, of, concat, from } from "rxjs";
import { Commit, Committed, CommitEvent } from "./committer";
import { concatMap, map, groupBy, reduce, flatMap, mapTo } from "rxjs/operators";
import { propsToArray, reduceToDict, tup, demux } from "../utils";
import { Manifest } from "./signals";
import uuid from 'uuid/v1'
import { ManifestStore } from "./ManifestStore";
import { pullAll } from "./eraSlicer";

export const pusher =
    (blockStore: BlockStore, manifestStore: ManifestStore) : OperatorFunction<Commit, Commit> =>
    pipe(
        map(commit => ({
            ...commit,
            event$: 
                of(commit.data).pipe(
                    concatMap(async data => {
                        const ref = uuid();
                        await blockStore.save(ref, data);   //but what if blockstore has an event to emit?
                        return tup(ref, data);
                    }),
                    concatMap(([blockRef, blockData]) => {
                        const oldLogBlock$ = from(propsToArray(commit.era.manifest.logBlocks));

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
                                    ...commit.era.manifest,
                                    version: commit.era.manifest.version + 1,
                                    logBlocks: logBlocks
                                })));
                    }),
                    concatMap(manifest =>
                        manifestStore.save(manifest).pipe(
                            demux('Gazumped', mapTo(gazumped())),
                            demux('Saved', mapTo(committed({ manifest, commit }))))),
                    pullAll())
        })));


function committed(o: { commit: Commit, manifest: Manifest}): CommitEvent {
    return ['Committed', o as Committed];
}

function gazumped(): CommitEvent {
    return ['Gazumped', {}];
}
