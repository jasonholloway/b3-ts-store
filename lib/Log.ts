import { reduce, map, scan, concatMap } from "rxjs/operators";
import { OperatorFunction, Observable, Subject, merge, from, concat, combineLatest } from "rxjs";
import { AnyUpdate, Model, Log } from "./bits";
import { LogSpec } from "./LogSpace";
import { concatMapEager, scanToArray } from "./utils";

type LogState<D> = {
    aggr: D,
    staged: any[],
    spec: LogSpec
}


type Reduction<V, A> = (v: V) => (ac: A) => A;
type LogReduction<V, D> = Reduction<V, LogState<D>>


export interface InnerLog {
     reset(): void
     staged: Observable<AnyUpdate[]>
}


export function createLogFacade<U extends AnyUpdate, D>(model: Model<U, D>, specs: Observable<LogSpec>, loadBlock: (ref: String) => Observable<U>): Log<U, any> & InnerLog {
    const updates = new Subject<U>();
    const resets = new Subject<void>();

    const log = createLogMachine('', model, specs, updates, resets, loadBlock);

    return {
        ...log,
        reset() {
            resets.next();
        },
        stage(update: U) {
            updates.next(update);
        },
        view(): Promise<any> {
            return log.views.toPromise();
        }
    }
}



export function createLogMachine<U extends AnyUpdate, D>(
        key: string, 
        model: Model<U, D>, 
        specs: Observable<LogSpec>, 
        updates: Observable<U>,
        resets: Observable<void>,
        loadBlock: (ref: string) => Observable<U>
    ) {

    const zero: LogState<D> = { 
        aggr: model.zero, 
        staged: [], 
        spec: { head: 0, blocks: [] }
    };


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


    const committeds = specs.pipe(
                            map(s => from(s.blocks)
                                    .pipe(concatMapEager(loadBlock)))
                        );


    const stageds = updates.pipe(scanToArray());

    const aggrs = combineLatest(committeds, stageds)
                    .pipe(map(([c, a]) => concat(c, a)))
                    .pipe(concatMap(all => all.pipe(reduce(model.add, model.zero))))


    const views = aggrs.pipe(
        //map(model.view)
    );

    return {
        key,
        staged: states.pipe(map(s => s.staged)),
        views
    }
}


function applyScan<A>(seed: A): OperatorFunction<(ac: A) => A, A> {
    return scan<(ac: A) => A, A>((ac, fn) => fn(ac), seed);
}
