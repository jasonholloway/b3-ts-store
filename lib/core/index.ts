import { Model, Evaluable, KnownLogs, KnownAggr } from "./evaluable";
import { BlockStore, ManifestStore } from "../bits";
import { startWith, shareReplay, mapTo, tap } from "rxjs/operators";
import { Signal, Manifest, NewEpoch, doReset } from "./signals";
import { pullBlocks as pullBlocks } from "./pullBlocks";
import { committer, DoCommit, Commit } from "./committer";
import { Observable, Subject, merge, zip, empty } from "rxjs";
import { pullManifests, PullManifest, pullManifest } from "./pullManifests";
import { pusher } from "./pusher";
import { createViewer } from "./viewer";
import { tup } from "../utils";
import { evaluateBlocks } from "./evaluateBlocks";
import { evaluator, EvaluableEra } from "./evaluator";
import { eraSlicer, Ripple } from "./eraSlicer";


export interface Core<M extends Model> {
    era$: Observable<EvaluableEra<M>>,
    commit$: Observable<Commit>,
    view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>>
} 

const emptyEvaluable: Evaluable = {
    logRef$: empty(),
    evaluate: () => empty()
}

export const newEpoch = (manifest: Manifest, blocks: Evaluable = emptyEvaluable): NewEpoch => 
    ['Epoch', tup(manifest, blocks)];


export const createCore =
    <M extends Model>
    (model: M, blockStore: BlockStore, manifestStore: ManifestStore) =>
    (ripple$: Observable<Ripple<any>>, doReset$: Observable<void>, doCommit$: Observable<DoCommit>) : Core<M> => {

    const pullManifest$ = new Subject<PullManifest>();
    const signal$ = new Subject<Signal>();

    ripple$ = tapCompletion(ripple$);
    doReset$ = tapCompletion(doReset$);
    doCommit$ = tapCompletion(doCommit$);

    const manifest$ = pullManifest$.pipe(
                        startWith(pullManifest()),
                        pullManifests(manifestStore),
                        shareReplay(1));

    const epoch$ = zip(
                    manifest$,
                    manifest$.pipe(
                        pullBlocks(blockStore),
                        evaluateBlocks(model)));
    
    const allSignal$ = merge(signal$, doReset$.pipe(mapTo(doReset())));

    const era$ = epoch$.pipe(
                    eraSlicer(allSignal$, ripple$),
                    evaluator(model));
                
    const commit$ = doCommit$.pipe(
                    committer(era$, signal$),
                    pusher(blockStore, manifestStore, pullManifest$));

    const viewer = createViewer(era$);

    return {
        era$,
        commit$,
        view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>> {
            return viewer(ref);
        }
    };

    function tapCompletion<V>(o$: Observable<V>): Observable<V> {
        return o$.pipe(tap({
            complete: () => {
                pullManifest$.complete();
                signal$.complete();
            } 
        }))
    }
}
