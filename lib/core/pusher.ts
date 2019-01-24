import { BlockStore, ManifestStore } from "../bits";
import { Observer, OperatorFunction, pipe, of, Observable, MonoTypeOperatorFunction, concat } from "rxjs";
import { Commit } from "./committer";
import { concatMap, tap, mapTo, catchError } from "rxjs/operators";
import { enumerate } from "../utils";
import { Manifest } from "./specifier";
import { PullManifest } from "./pullManifests";
import { Model } from "./evaluateSlices";

export const pusher =
    (blockStore: BlockStore, manifestStore: ManifestStore, pull$: Observer<PullManifest>) : OperatorFunction<Commit, Commit> =>
    pipe(
        concatMap(commit =>
            of(commit.data).pipe(
                concatMap(async data => {
                    const ref = 'block0';
                    await blockStore.save(ref, commit.data);
                    return ref;
                }),
                concatMap(blockRef => {
                    const logRefs = enumerate(commit.data).map(([k]) => k);

                    const manifest: Manifest = {
                        ...commit.era.manifest,
                        version: commit.era.manifest.version + 1,
                        logBlocks: { myLog: [ 'block0' ] }
                    };

                    return manifestStore.save(manifest)
                            .pipe(tap({ 
                                error: () => pull$.next(['PullManifest', {}])
                            }));
                }),
                mapTo(commit),
                mergeErrorsInto(commit)
            ))
        );


function mergeErrorsInto<F extends { errors: Observable<Error> }>(frame: F) : MonoTypeOperatorFunction<F> {
    return catchError(err => 
        of({ 
            ...frame as object,
            errors: concat(frame.errors, of(err)) 
        } as F));
}
