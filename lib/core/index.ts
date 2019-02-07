import { Model, Evaluable, KnownLogs, KnownAggr } from "./evaluable";
import { BlockStore, ManifestStore } from "../bits";
import { startWith, shareReplay, mapTo, tap, concatMap, map } from "rxjs/operators";
import { Signal, Manifest, NewEpoch, doReset } from "./signals";
import { pullBlocks as pullBlocks } from "./pullBlocks";
import { committer, DoCommit, Commit, Committed } from "./committer";
import { Observable, Subject, merge, zip, empty } from "rxjs";
import { pullManifests, PullManifest, pullManifest } from "./pullManifests";
import { pusher } from "./pusher";
import { createViewer } from "./viewer";
import { tup, extract } from "../utils";
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

    const pullManifest$ = new Subject<PullManifest>();  //should just be on a timer
    const signal$ = new Subject<Signal>();
    const committed$ = new Subject<Committed>();

    ripple$ = tapCompletion(ripple$);
    doReset$ = tapCompletion(doReset$);
    doCommit$ = tapCompletion(doCommit$);
    
    const manifest$ = merge(
                        pullManifest$.pipe(
                            startWith(pullManifest()),
                            pullManifests(manifestStore)),
                        committed$.pipe(
                            map(({manifest}) => manifest)));        //commit info needs to be passed through here...
                                                                    //but shouldbe on epoch rather than manifest
    const epoch$ = zip(
                    manifest$,
                    manifest$.pipe(
                        pullBlocks(blockStore),
                        evaluateBlocks(model)));
    
    const allSignal$ = merge(signal$, doReset$.pipe(mapTo(doReset())));

    const era$ = epoch$.pipe(
                    eraSlicer(allSignal$, ripple$),
                    evaluator(model),   //would be nice if this were part of the interior scan(?)
                    shareReplay(1));

    const commit$ = doCommit$.pipe(
                    committer(era$),
                    pusher(blockStore, manifestStore),              //remember... pusher should be moved inside committer to catch errors
                    shareReplay(1));

    commit$.pipe(
        concatMap(comm => 
            comm.event$.pipe(                
                extract('Committed'))))
        .subscribe(committed$);

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
                committed$.complete();
                signal$.complete();
            } 
        }))
    }
}
