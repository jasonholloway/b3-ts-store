import { reduce, map, flatMap, tap, mergeAll, scan, concatMap } from "rxjs/operators";
import { OperatorFunction, Observable, Subject, merge, of, forkJoin, from, pipe } from "rxjs";
import { AnyUpdate, Model, Log } from "./bits";
import { LogSpec } from "./LogSpace";
import { publish, concatMapEager } from "./utils";

type LogState<D> = {
    aggr: D,
    staged: any[],
    spec: LogSpec
}

type Id<T> = ((t: T) => T)

type Reduction<V, A> = (v: V) => (ac: A) => A;
type LogReduction<V, D> = Reduction<V, LogState<D>>


export interface InnerLog {
    reset(): void
    staged: Observable<AnyUpdate[]>
}

export function createLog<U extends AnyUpdate, D, V>(
        key: string, 
        model: Model<U, D, V>, 
        specs: Observable<LogSpec>, 
        loadBlock: (ref: string) => Observable<U>
    ) {

    const zero: LogState<D> = { 
        aggr: model.zero, 
        staged: [], 
        spec: { head: 0, blocks: [] }
    };

    const updates = new Subject<U>();
    const resets = new Subject<void>();

    //aggregations can be derived from the latest state of the log
    //as in, updates can just be joined onto staging
    //but what of bad updates? as in, an update that makes no sense to the model?
    //there has to be some chance of validation here
    //updates should be aggregated and filtered upstream of the overall log state
    //and the aggregated state should therefore be reduced upstream

    //but updates here can't be alone
    //there also have to be updates loaded from the store
    //which would be loaded and reduced via the model
    //these committeds have to be reduced to a single set/aggregation
    //and on each new view of the committed updates,
    //our set of staged updates is recombined with it to give a view of staging

    //the thing is, these committed updates have to be triggered in the first place:
    //the first update or attempt at a view has to call an upstream source of blocks
    //that will return a stream of updates that need to be merged into

    //for every block we need,
    //we should load updates for it
    //and flatMap the resulting stream into one
    //(but preserving the orderof the blocks!)
    
    //but we know our blocks before we want to load them
    //on an update, we want to subscribe to the *cold* stream of updates from the store
    //and we want to somehow merge into this new upstream
    //there must be some premade operator that does exactly this
    //but for this we need to look...
    //


    const onUpdate: LogReduction<U, D>
        = update => state => ({
            //here we need all committed updates to be loaded
            //so: not just on update
                ...state,
                staged: [...state.staged, update]
            });

    //when new spec comes in,
    //we should store it in the state
    //anyone listening for new aggrs
    //should now pull through the latest state'n'spec
    //which should load all blocks, aggregate these
    //and pass them down

    //not sure what the point of the LogState is, here;
    //LogSpec + staging = all updates; simple as that
    //the complication comes when we want to save effort,
    //and just apply new updates on top of existing aggregations
    //well - CommittedUpdates would be aggregated one by one as they come through
    //and the CommittedAggr would be tapped by the StagedAggr, which would apply 
    //staged updates freshly on top of it
    const onSpec: LogReduction<LogSpec, D>
        = spec => state => {
            //we don't need to aggregate here, just to change indices in the state
            return {
                ...state,
                spec
            };
        };

    const onReset: LogReduction<void, D>
        = () => state => ({
            //here we just reset indices
            //and clear out staging
                ...state,
                staged: []
            });
    
    const states = merge(
                        updates.pipe(map(onUpdate)),                        
                        resets.pipe(map(onReset)),
                        specs.pipe(map(onSpec))
                    )
                    .pipe(applyScan(zero));


    const committeds = specs
                        .pipe(map(s => from(s.blocks)
                                        .pipe(concatMapEager(loadBlock))
                                    ));

    const aggrs = committeds.pipe(
        flatMap(h => h.pipe(reduce(model.add, model.zero)))
    );

    const views = aggrs.pipe(
        map(model.view)
    );

    return {
        key,
        staged: states.pipe(map(s => s.staged)),

        views,

        stage(update: U): void {
            updates.next(update);            
        },

        reset(): void {
            resets.next();
        },

        view(): Promise<V> {
            return views.toPromise();
        }
    }
}


function applyScan<A>(seed: A): OperatorFunction<(ac: A) => A, A> {
    return scan<(ac: A) => A, A>((ac, fn) => fn(ac), seed);
}
