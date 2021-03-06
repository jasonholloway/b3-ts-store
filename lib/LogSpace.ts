import { Subject, Observable, empty, of, interval, concat } from "rxjs";
import { tup, extract } from "./utils";
import { createCore } from "./core";
import { DoCommit, Commit } from "./core/committer";
import { Ripple, pullAll } from "./core/eraSlicer";
import uuid from 'uuid';
import { concatMap, timeout, first, filter, take } from "rxjs/operators";
import { ManifestStore } from "./core/ManifestStore";
import { BlockStore } from "./core/BlockStore";
import { Model, KnownLogs, KnownAggr } from "./model";

export interface LogSpace<M extends Model> {
    getLog<K extends KnownLogs<M>, V extends KnownAggr<M, K>>(key: K): Log<M, K, V>,

    commit(): Observable<Error>,
    reset(): void,
    complete(): void 

    commit$: Observable<Commit>
    error$: Observable<Error>   
}

export interface Log<M extends Model, K extends KnownLogs<M>, V extends KnownAggr<M, K>> {
    ref: K,
    stage(update: any): void,
    view$: Observable<V>
}



export function createLogSpace<M extends Model>(model: M, manifests: ManifestStore, blocks: BlockStore): LogSpace<M> {

    const ripple$ = new Subject<Ripple>();
    const doReset$ = new Subject<void>();
    const doCommit$ = new Subject<DoCommit>();

    const doPull$ = concat(of(0), interval(10000));

    const core = createCore(model, blocks, manifests)(ripple$, doPull$, doReset$, doCommit$);

    return {
        getLog<K extends KnownLogs<M>, V extends KnownAggr<M, K>>(ref: K): Log<M, K, V> {
            return {
                ref,
                view$: core.view(ref),
                stage(update) {
                    const ripple = of(tup(ref, of(update)));
                    ripple$.next(ripple);
                }
            };
        },

        commit(): Observable<Error> {
            const id = uuid();

            const commit$ = core.commit$.pipe(
                                filter(c => c.id == id),
                                take(1),
                                timeout(200),
                                concatMap(c => c.event$.pipe(extract('Error'))),
                                pullAll())

            doCommit$.next({ id });

            return commit$;
        },

        reset(): void {
            doReset$.next();
        },

        commit$: core.commit$,

        error$: empty(),

        complete() {
            core.close();
            ripple$.complete();
            doReset$.complete();
            doCommit$.complete();
        }
    };
}
