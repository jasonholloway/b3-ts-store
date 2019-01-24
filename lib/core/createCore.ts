import { Model, evaluateSlices, Evaluable, KnownLogs, KnownAggr } from "./evaluateSlices";
import { BlockStore, ManifestStore } from "../bits";
import { startWith, map, shareReplay } from "rxjs/operators";
import { specifier, Signal, Manifest, Epoch } from "./specifier";
import { pullBlocks as pullBlocks } from "./pullBlocks";
import { slicer, Ripple, EraWithSlices, mapSlices } from "./slicer";
import { committer, DoCommit, Commit } from "./committer";
import { Observable, Subject, merge, zip, empty } from "rxjs";
import { pullManifests, PullManifest, pullManifest } from "./pullManifests";
import { pusher } from "./pusher";
import { createViewer } from "./viewer";
import { tup } from "../utils";
import { evaluateBlocks } from "./evaluateBlocks";


export interface Core<M extends Model> {
    era$: Observable<EraWithSlices<Evaluable<M>>>,
    commit$: Observable<Commit>,
    view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>>
} 

const emptyEvaluable: Evaluable = {
    logRefs: empty(),
    evaluate: () => empty()
}

export const newEpoch = (manifest: Manifest, blocks: Evaluable = emptyEvaluable): Epoch => 
    ['Epoch', tup(manifest, blocks)];


export const createCore =
    <M extends Model>
    (model: M, blockStore: BlockStore, manifestStore: ManifestStore) =>
    (ripple$: Observable<Ripple<any>>, doCommit$: Observable<DoCommit>) : Core<M> => {

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
                    committer(era$, signal$),
                    pusher(blockStore, manifestStore, pullManifest$));

    const evaluable$ = era$.pipe(mapSlices(([_, evaluable]) => evaluable));

    const viewer = createViewer(evaluable$);

    return {
        era$: evaluable$,
        commit$,
        view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>> {
            return viewer(ref);
        }
    };
}
