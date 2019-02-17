import { AnyUpdate } from "./bits";
import { Observable } from "rxjs";


export function declareLogModel<U extends AnyUpdate, D>(m: LogModel<U, D>): LogModel<U, D> {
    return m;
}

export type LogModel<U, D> = {
    zero: D,
    add(data: D, update: U): D
}



export class ModelBuilder<L extends LogModels> {

    static default = new ModelBuilder({ logs: {}, derivations: [] })

    private model: Model<L>;

    private constructor(model: Model<L>) {
        this.model = model;
    }

    log<T extends string, M extends LogModel<any, any>>
        (type: T, logModel: M) : ModelBuilder<L & { [type in T]: M }> {
            return new ModelBuilder({ 
                ...this.model, 
                logs: { 
                    ...this.model.logs,
                    ...({ [type]: logModel } as { [type in T]: M })
                } 
            });
    }

    derive<F extends keyof L>
        (from: F, to: (u: InferLogUpdates<L, F>) => Observable<any>) : ModelBuilder<L> {  //HOW TO TYPE CONCAT HERE???
        // throw 1234;
        return this;
    }

    done(): Model<L> {
        return this.model;
    }
}

type InferLogUpdates<L extends LogModels, T extends keyof L> =
    L[T] extends LogModel<infer U, infer D> ? U : never;




export type KnownLogs<M extends Model>
    = Extract<keyof M['logs'], string>

export type KnownAggr<M extends Model, K extends keyof M['logs']>
    = M['logs'][K]['zero']



type LogModels = 
    { [type: string]: LogModel<any, any> }


export interface Model<L extends LogModels = any> {
    logs: L,
    derivations: { 
        from: keyof L, to: (update: any) => Observable<any> 
    }[]
}




const buildModel = ModelBuilder.default;


