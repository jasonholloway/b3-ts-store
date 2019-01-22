import { Model, evaluate, LogRef } from "./evaluate";
import { BlockStore, ManifestStore } from "./bits";
import { startWith } from "rxjs/operators";
import { newEra, specifier, Signal } from "./specifier";
import { serveBlocks } from "./serveBlocks";
import { slicer, Ripple } from "./slicer";
import { committer, DoCommit } from "./committer";
import { Observable, Subject, merge } from "rxjs";
import { puller, PullManifest } from "./puller";
import { pusher } from "./pusher";

export const createStore =
    <M extends Model>
    (model: M, blockStore: BlockStore, manifestStore: ManifestStore) =>
    (ripple$: Observable<Ripple<any>>, doCommit$: Observable<DoCommit>) => {

    const pullManifest$ = new Subject<PullManifest>();
    const signal$ = new Subject<Signal>();

    const manifest$ = pullManifest$.pipe(
                        puller(manifestStore));

    const era$ = merge(signal$, manifest$).pipe(
                    startWith(newEra()),
                    specifier(),
                    serveBlocks(blockStore),
                    slicer(ripple$),
                    evaluate(model));

    const commit$ = doCommit$.pipe(
                    committer(model, era$, signal$),
                    pusher(blockStore, manifestStore, pullManifest$));

    return {
        era$,
        commit$,
        manifest$,
        view(ref: LogRef) {
            throw 123;
        }
    };
}
