import { ManifestStore, BlockStore } from "./bits";
import { Subject, Observable, empty, of } from "rxjs";
import { tup } from "./utils";
import { Model, KnownLogs, KnownAggr } from "./core/evaluable";
import { createCore } from "./core";
import { DoCommit, Commit } from "./core/committer";
import { Ripple } from "./core/eraSlicer";


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

            // const entry = getOrSet(logs, key, () => { 
            //     return createLogFacade(model, null, null);
            // });
            // return entry;
        },

        commit(): void {
            doCommit$.next(123);
        },

        reset(): void {
            doReset$.next();
        },

        commit$: core.commit$,

        error$: empty(),

        complete() {            
            ripple$.complete();
            doReset$.complete();
            doCommit$.complete();
        }
    };
}
