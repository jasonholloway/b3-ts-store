
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
    load(): Promise<void>;
    view(): Promise<V>;
}


export interface Store<U> {
    readAll(name: string): Promise<U[]>;
    persist(name: string, batch: U[]): Promise<void>;
}


class Registry<K, A> {
    private records = new Map<K, A>()

    getOrCreate<B extends A>(key: K, create: () => B): B {
        if(this.records.has(key)) {
            return this.records.get(key) as B;
        }
        const log = create();
        this.records = this.records.set(key, log);
        return log;
    }

    forEach(fn: (el: A, key: K) => void) {
        this.records.forEach(fn);
    }

    values(): A[] {
        return Array.from(this.records.values());
    }
}


export class LogSpace {
    
    logs = new Registry<string, InnerLog>()
    store: Store<any>

    constructor(store: Store<any>) {
        this.store = store;
    }

    getLog<U, D, V>(name: string, model: Model<U, D, V>): Log<U, V> {
        return this.logs.getOrCreate(name, () => new InnerLogImpl(model));
    }

    reset(): void {
        this.logs.forEach(l => l.reset());
    }

    async commit(): Promise<void> {

        const staged = this.logs.values()
                            .map(l => {
                                
                            });

        //in committing,
        //we want to get the staged updates of each log
        //and store all of them
        //

        //how to stage while committing?
        //its like updates should be provisionally half-labelled as persistent
        
        //there'd be committed, limbo, and staged sections of each log
        //when a log is reset, it shouldn't get rid of its limbo entries
        //but, if the server belatedly says 'no!'..


    }
}


interface InnerLog {
    reset(): void,
    beginCommit(): { pending: any[], confirm: () => void }
}

class InnerLogImpl<U, D, V> implements Log<U, V>, InnerLog {

    model: Model<U, D, V>
    data: D
    limbo: { updates: U[], data: D }
    staged: { updates: U[], data: D }

    constructor(model: Model<U, D, V>) {
        this.model = model;
        this.data = model.zero;
        this.staged = { updates: [], data: this.data };
    }

    stage(update: U): void {
        this.staged.data = this.model.add(this.staged.data, update);
        this.staged.updates.push(update);
    }

    reset(): void {
        this.staged = { updates: [], data: this.data };
    }

    beginCommit(): { pending: any[], confirm: () => void } {
        const pending = this.staged.updates as any[];

        this.limbo.updates.push(...this.staged.updates);
        this.limbo.data = this.staged.data;
        this.staged.updates = [];

        return {
            pending,
            confirm: () => {}
        };
    }

    async load(): Promise<void> {
        // const updates = await this.store.readAll('blah');
        // this.data = updates.reduce((d, u) => this.model.add(d, u), this.model.zero);
        // this.reset();
    }

    async view(): Promise<V> {
        //should load here?
        return this.model.view(this.staged.data);
    }
}
