
export function declareModel<U, D, V>(m: Model<U, D, V>): Model<U, D, V> {
    return m;
}

export type Model<U, D, V> = {
    zero: D,
    add(data: D, update: U): D,
    view(data: D): V
}

export interface Log<U, V> {    
    stage(update: U): void;
    commit(): Promise<void>;
    view(): Promise<V>;
}


export class LogSpace {
    getLog<U, D, V>(name: string, model: Model<U, D, V>): Log<U, V> {
        throw Error('wip')
    }
}
