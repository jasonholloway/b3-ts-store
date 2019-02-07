import { Model, Evaluable, KnownLogs, KnownAggr } from "./evaluable";
import { BlockStore, ManifestStore } from "../bits";
import { shareReplay, mapTo, concatMap, map, flatMap, takeUntil } from "rxjs/operators";
import { Signal, Manifest, NewEpoch, doReset } from "./signals";
import { pullBlocks as pullBlocks } from "./pullBlocks";
import { committer, DoCommit, Commit, Committed } from "./committer";
import { Observable, Subject, merge, empty, timer, of } from "rxjs";
import { pullManifests } from "./pullManifests";
import { pusher } from "./pusher";
import { createViewer } from "./viewer";
import { tup, extract, logComplete, log } from "../utils";
import { evaluateBlocks } from "./evaluateBlocks";
import { evaluator, EvaluableEra } from "./evaluator";
import { eraSlicer, Ripple, Epoch, pullReplay } from "./eraSlicer";


export interface Core<M extends Model> {
    era$: Observable<EvaluableEra<M>>,
    commit$: Observable<Commit>,
    view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>>,
    close()
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

    const committed$ = new Subject<Committed>();
    const close$ = new Subject();

    doReset$ = completeOnClose(doReset$);
    ripple$ = completeOnClose(ripple$);
    doCommit$ = completeOnClose(doCommit$);
    
    const epoch$ = merge<Epoch>(
                    timer(0, 10000).pipe(
                        takeUntil(close$),
                        pullManifests(manifestStore),
                        map(manifest => ({ manifest }))),
                    committed$.pipe(
                        takeUntil(close$)));
                            
    const evalEpoch$ = epoch$.pipe(
                        concatMap(epoch => 
                            of(epoch.manifest).pipe(
                                pullBlocks(blockStore),
                                evaluateBlocks(model),
                                map(evaluable => ({ ...epoch, ...evaluable }))
                            )));
                        
    const reset$ = doReset$.pipe(mapTo(doReset()));

    const era$ = evalEpoch$.pipe(
                    eraSlicer(reset$, ripple$),
                    evaluator(model),   //would be nice if this were part of the interior scan(?)
                    shareReplay(1));

    const commit$ = doCommit$.pipe(                    
                    committer(era$),
                    pusher(blockStore, manifestStore),              //remember... pusher should be moved inside committer to catch errors
                    shareReplay(1));

    commit$.pipe(
        flatMap(c => c.event$),
        extract('Committed'))
        .subscribe(committed$);

    const viewer = createViewer(era$);

    return {
        era$,
        commit$,
        view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>> {
            return viewer(ref);
        },
        close() {
            close$.next();
        }
    };

    function completeOnClose<V>(o$: Observable<V>): Observable<V> {
        return o$.pipe(takeUntil(close$));
    }
}
