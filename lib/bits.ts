
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
        return new LogImpl(model);
    }
}


class LogImpl<U, D, V> implements Log<U, V> {

    data: D
    model: Model<U, D, V>

    constructor(model: Model<U, D, V>) {
        this.model = model;
        this.data = model.zero
    }

    stage(update: U): void {
        this.data = this.model.add(this.data, update);
    }

    commit(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    view(): Promise<V> {
        return Promise.resolve(this.model.view(this.data));
    }
}
