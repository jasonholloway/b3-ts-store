import { Log, ManifestStore, BlockStore } from "./bits";
import { Subject } from "rxjs";
import { getOrSet } from "./utils";
import { InnerLog, createLogFacade } from "./Log";
import { Model, KnownLogs } from "./core/evaluateSlices";
import { createCore } from "./core";
import { Ripple } from "./core/slicer";
import { DoCommit } from "./core/committer";


export interface LogSpace<M extends Model> {
    getLog(key: KnownLogs<M>): Log<U, any>;
    commit(): void;
    reset(): void;
}


export function createLogSpace<M extends Model>(model: M, manifests: ManifestStore, blocks: BlockStore): LogSpace<M> {
    let logs: { [key: string]: InnerLog } = {}

    const ripple$ = new Subject<Ripple>();
    const doCommit$ = new Subject<DoCommit>();

    const core = createCore(model, blocks, manifests)(ripple$, doCommit$);


    return {
        getLog(key: KnownLogs<M>): Log<U, any> {
            const entry = getOrSet(logs, key, () => { 
                return createLogFacade(model, null, null);
            });
            return entry;
        },

        commit(): void {
            doCommit$.next(123);
        },

        reset(): void {
            // enumerate(this.logs)
                // .forEach(([_, l]) => l.reset());
        }

    };
}
