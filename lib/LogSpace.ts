import { BlockStore } from "./bits";
import { Subject, Observable, empty, of } from "rxjs";
import { tup, demux, extract, log, logVal } from "./utils";
import { Model, KnownLogs, KnownAggr } from "./core/evaluable";
import { createCore } from "./core";
import { DoCommit, Commit } from "./core/committer";
import { Ripple, pullAll } from "./core/eraSlicer";
import uuid from 'uuid';
import { concatMap, timeout, first } from "rxjs/operators";
import { ManifestStore } from "./core/ManifestStore";

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

    const core = createCore(model, blocks, manifests)(ripple$, doReset$, doCommit$);

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
                                first(c => c.id == id),
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
