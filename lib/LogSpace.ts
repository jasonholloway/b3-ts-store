import { ManifestStore, BlockStore } from "./bits";
import { Subject, Observable, empty, of } from "rxjs";
import { getOrSet, tup } from "./utils";
import { InnerLog, createLogFacade } from "./Log";
import { Model, KnownLogs, KnownAggr } from "./core/evaluateSlices";
import { createCore } from "./core";
import { Ripple } from "./core/slicer";
import { DoCommit, Commit } from "./core/committer";


export interface LogSpace<M extends Model> {
    getLog<K extends KnownLogs<M>, V extends KnownAggr<M, K>>(key: K): Log<M, K, V>,

    commit(): void,
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
    const doCommit$ = new Subject<DoCommit>();

    const core = createCore(model, blocks, manifests)(ripple$, doCommit$);

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

            // const entry = getOrSet(logs, key, () => { 
            //     return createLogFacade(model, null, null);
            // });
            // return entry;
        },

        commit(): void {
            doCommit$.next(123);
        },

        reset(): void {
            // enumerate(this.logs)
                // .forEach(([_, l]) => l.reset());
        },

        commit$: core.commit$,

        error$: empty(),

        complete() {
            ripple$.complete();
            doCommit$.complete();
        }
    };
}
