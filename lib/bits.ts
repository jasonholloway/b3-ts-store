
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
    reset(): void;
    load(): Promise<void>;
    commit(): Promise<void>;
    view(): Promise<V>;
}



export interface Store<U> {
    readAll(name: string): Promise<U[]>;
    persist(name: string, batch: U[]): Promise<void>;
}

export class LogSpace {
    getLog<U, D, V>(name: string, model: Model<U, D, V>, store: Store<U>): Log<U, V> {
        return new LogImpl(model, store);
    }
}


class LogImpl<U, D, V> implements Log<U, V> {

    model: Model<U, D, V>
    data: D
    staged: { updates: U[], data: D }
    store: Store<U>

    constructor(model: Model<U, D, V>, store: Store<U>) {
        this.model = model;
        this.data = model.zero;
        this.staged = { updates: [], data: this.data };
        this.store = store;
    }

    stage(update: U): void {
        this.staged.data = this.model.add(this.staged.data, update);
        this.staged.updates.push(update);
    }

    reset(): void {
        this.staged = { updates: [], data: this.data };
    }

    async load(): Promise<void> {
        const updates = await this.store.readAll('blah');
        this.data = updates.reduce((d, u) => this.model.add(d, u), this.model.zero);
        this.reset();
    }

    async commit(): Promise<void> {
        await this.store.persist('blah', this.staged.updates);        
    }

    async view(): Promise<V> {
        //should load here?
        return this.model.view(this.staged.data);
    }
}
