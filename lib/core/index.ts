import { Model, Evaluable, KnownLogs, KnownAggr } from "./evaluable";
import { BlockStore, ManifestStore } from "../bits";
import { shareReplay, mapTo, tap, concatMap, map, flatMap, startWith, takeUntil } from "rxjs/operators";
import { Signal, Manifest, NewEpoch, doReset } from "./signals";
import { pullBlocks as pullBlocks } from "./pullBlocks";
import { committer, DoCommit, Commit, Committed } from "./committer";
import { Observable, Subject, merge, empty, timer, of } from "rxjs";
import { pullManifests } from "./pullManifests";
import { pusher } from "./pusher";
import { createViewer } from "./viewer";
import { tup, extract, log } from "../utils";
import { evaluateBlocks } from "./evaluateBlocks";
import { evaluator, EvaluableEra } from "./evaluator";
import { eraSlicer, Ripple, Epoch } from "./eraSlicer";


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

    const signal$ = new Subject<Signal>();
    const committed$ = new Subject<Committed>();
    const close$ = new Subject();

    ripple$ = tapCompletion(ripple$);
    doReset$ = tapCompletion(doReset$);
    doCommit$ = tapCompletion(doCommit$);
    
    const epoch$ = merge<Epoch>(
                    timer(0, 10000).pipe(
                        pullManifests(manifestStore),
                        map(manifest => ({ manifest }))),
                    committed$);
                            
    const evalEpoch$ = epoch$.pipe(
                        concatMap(epoch => 
                            of(epoch.manifest).pipe(
                                pullBlocks(blockStore),
                                evaluateBlocks(model),
                                map(evaluable => ({ ...epoch, ...evaluable }))
                            )));
                        
    const allSignal$ = merge(signal$, doReset$.pipe(mapTo(doReset())));

    const era$ = evalEpoch$.pipe(
                    eraSlicer(allSignal$, ripple$),
                    evaluator(model),   //would be nice if this were part of the interior scan(?)
                    takeUntil(close$),
                    shareReplay(1));

    const commit$ = doCommit$.pipe(
                    committer(era$),
                    pusher(blockStore, manifestStore),              //remember... pusher should be moved inside committer to catch errors
                    takeUntil(close$),
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
        }
    };

    function tapCompletion<V>(o$: Observable<V>): Observable<V> {
        return o$.pipe(tap({
            complete: () => {
                close$.next();
                // committed$.complete();
                // signal$.complete();
            } 
        }))
    }
}
