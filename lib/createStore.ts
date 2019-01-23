import { Model, evaluate, LogRef, Evaluable, KnownLogs, KnownAggr } from "./evaluate";
import { BlockStore, ManifestStore } from "./bits";
import { startWith } from "rxjs/operators";
import { newEra, specifier, Signal, EraWithSpec, NewManifest } from "./specifier";
import { serveBlocks } from "./serveBlocks";
import { slicer, Ripple, EraWithSlices } from "./slicer";
import { committer, DoCommit, Commit } from "./committer";
import { Observable, Subject, merge } from "rxjs";
import { puller, PullManifest, pullManifest } from "./puller";
import { pusher } from "./pusher";
import { createViewer } from "./viewer";


export interface Store<M extends Model> {
    era$: Observable<EraWithSpec & EraWithSlices<Evaluable<M>>>,
    commit$: Observable<Commit>,
    view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>>
} 



export const createStore =
    <M extends Model>
    (model: M, blockStore: BlockStore, manifestStore: ManifestStore) =>
    (ripple$: Observable<Ripple<any>>, doCommit$: Observable<DoCommit>) : Store<M> => {

    const pullManifest$ = new Subject<PullManifest>();
    const signal$ = new Subject<Signal>();

    const manifest$ = pullManifest$.pipe(
                        startWith(pullManifest()),
                        puller(manifestStore));

    const era$ = merge(signal$, manifest$).pipe(
                    specifier(),
                    serveBlocks(blockStore),
                    slicer(ripple$),
                    evaluate(model));

    const commit$ = doCommit$.pipe(
                    committer(model, era$, signal$),
                    pusher(blockStore, manifestStore, pullManifest$));

    const viewer = createViewer<M>(era$);

    return {
        era$,
        commit$,
        view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>> {
            return viewer(ref);
        }
    };
}
