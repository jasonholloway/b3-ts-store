import { Model, evaluateSlices, LogRef, Evaluable, KnownLogs, KnownAggr } from "./evaluateSlices";
import { BlockStore, ManifestStore } from "./bits";
import { startWith, share, mapTo, map, shareReplay } from "rxjs/operators";
import { newEra, specifier, Signal, Manifest, Epoch } from "./specifier";
import { pullBlocks as pullBlocks, BlockFrame } from "./pullBlocks";
import { slicer, Ripple, EraWithSlices } from "./slicer";
import { committer, DoCommit, Commit } from "./committer";
import { Observable, Subject, merge, empty, zip, OperatorFunction, pipe } from "rxjs";
import { pullManifests, PullManifest, pullManifest } from "./pullManifests";
import { pusher } from "./pusher";
import { createViewer } from "./viewer";
import { tup, log } from "./utils";
import { evaluateBlocks } from "./evaluateBlocks";


export interface Store<M extends Model> {
    era$: Observable<EraWithSlices<Evaluable<M>>>,
    commit$: Observable<Commit>,
    view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>>
} 


export const newEpoch = (manifest: Manifest, blocks: BlockFrame): Epoch => 
    ['Epoch', tup(manifest, blocks)];


export const createStore =
    <M extends Model>
    (model: M, blockStore: BlockStore, manifestStore: ManifestStore) =>
    (ripple$: Observable<Ripple<any>>, doCommit$: Observable<DoCommit>) : Store<M> => {

    const pullManifest$ = new Subject<PullManifest>();
    const signal$ = new Subject<Signal>();

    const manifest$ = pullManifest$.pipe(
                        startWith(pullManifest()),
                        pullManifests(manifestStore),
                        shareReplay(1));

    const epoch$ = zip(
                    manifest$,
                    manifest$.pipe(
                        pullBlocks(blockStore),
                        evaluateBlocks(model))
                    ).pipe(map(e => newEpoch(...e)));
    
    const era$ = merge(epoch$, signal$).pipe(
                    specifier(),
                    slicer(ripple$),
                    evaluateSlices(model));

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
