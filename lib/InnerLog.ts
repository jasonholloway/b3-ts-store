import { reduce, map } from "rxjs/operators";
import { OperatorFunction, Observable, Subject, merge } from "rxjs";
import { AnyUpdate, Model, Log } from "./bits";
import { LogSpec } from "./LogSpace";

type LogState<D> = {
    aggr: D,
    head: number,
    staged: any[]
}

type Id<T> = ((t: T) => T)

type Reduction<V, A> = (v: V) => (ac: A) => A;
type LogReduction<V, D> = Reduction<V, LogState<D>>


export interface InnerLog {
    reset(): void
    staged: Observable<AnyUpdate[]>
}


export function createInnerLog<U extends AnyUpdate, D, V>(
        key: string, 
        model: Model<U, D, V>, 
        specs: Observable<LogSpec>, 
        loadBlock: (ref: string) => Observable<U>
    ): InnerLog & Log<U, V> {

    const zero: LogState<D> = { aggr: model.zero, head: 0, staged: [] };

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

    const onUpdate: LogReduction<U, D>
        = update => state => ({
            //here we need all committed updates to be loaded
            //so: not just on update
                ...state,
                staged: [...state.staged, update]
            });

    const onSpec: LogReduction<LogSpec, D>
        = spec => state => {
            //we don't need to aggregate here, just to change indices in the state
            return {
                ...state,
                head: spec.head
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
                        specs.pipe(map(onSpec)),
                        resets.pipe(map(onReset))
                    )
                    .pipe(applyReductionsTo(zero));

    const views = states.pipe(map(s => model.view(s.aggr)));


    return {
        key,
        staged: states.pipe(map(s => s.staged)),

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


function applyReductionsTo<A>(seed: A): OperatorFunction<(ac: A) => A, A> {
    return reduce<(ac: A) => A, A>((ac, fn) => fn(ac), seed);
}
