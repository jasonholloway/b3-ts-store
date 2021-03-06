import { shareReplay, mapTo, concatMap, map, flatMap, takeUntil } from "rxjs/operators";
import { doReset, emptyManifest } from "./signals";
import { pullBlocks as pullBlocks } from "./pullBlocks";
import { committer, DoCommit, Commit, Committed } from "./committer";
import { Observable, Subject, merge, of } from "rxjs";
import { pullManifests } from "./pullManifests";
import { createViewer } from "./viewer";
import { demux as demux, pipeTo } from "../utils";
import { evaluateBlocks } from "./evaluateBlocks";
import { evaluator, EvaluableEra } from "./evaluator";
import { eraSlicer, Ripple, Epoch } from "./eraSlicer";
import { ManifestStore } from "./ManifestStore";
import { BlockStore } from "./BlockStore";
import { Model, KnownLogs, KnownAggr } from "../model";


export interface Core<M extends Model> {
    era$: Observable<EvaluableEra<M>>,
    commit$: Observable<Commit>,
    view<K extends KnownLogs<M>>(ref: K): Observable<KnownAggr<M, K>>,
    close()
} 

export const createCore =
    <M extends Model>
    (model: M, blockStore: BlockStore, manifestStore: ManifestStore) =>
    (ripple$: Observable<Ripple<any>>, doPull$: Observable<any>, doReset$: Observable<void>, doCommit$: Observable<DoCommit>) : Core<M> => {

    const close$ = new Subject();
    const pushed$ = new Subject<Committed>();
    const gazumped$ = new Subject<{}>();
    const error$ = new Subject<Error>();

    ripple$ = completeOnClose(ripple$);
    doPull$ = completeOnClose(doPull$);
    doReset$ = completeOnClose(doReset$);
    doCommit$ = completeOnClose(doCommit$);
    
    // error$.subscribe(err => console.error(err));

    const epoch$ = merge<Epoch>(
                    of({ manifest: emptyManifest }),
                    merge(doPull$, gazumped$).pipe(
                        takeUntil(close$),
                        pullManifests(manifestStore),
                        map(manifest => ({ manifest }))),
                    pushed$.pipe(
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
                    committer(era$, blockStore, manifestStore), //REMEMBER!!! gotta put pushing within exhaust TODO
                    shareReplay(1));

    commit$.pipe(
        flatMap(c => c.event$),
        demux('Committed', pipeTo(pushed$)),
        demux('Gazumped', pipeTo(gazumped$)),
        demux('Error', pipeTo(error$)));

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
