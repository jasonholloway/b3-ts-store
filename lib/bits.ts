
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
    persist(block: { [key: string]: any[] }): Promise<void>;
}




export type Block = {
    [keys: string]: any[]
}

export interface BlockStore {
    load(key: string): Promise<Block>;
    save(key: string, block: Block);
}


//the Store 
//
//
//



class Registry<V> {
    private records: { [key: string]: V } = {}

    getOrCreate<W extends V>(key: string, create: () => W): W {
        const found = this.records[key] as W;
        return found        
            || (this.records[key] = create());
    }

    entries(): { key: string, val: V }[] {
        return Object.keys(this.records)
                .map(key => ({ key, val: this.records[key] }));
    }

    values(): V[] {
        return this.entries()
                .map(({ val }) => val);
    }
}


export class LogSpace {
    
    logs = new Registry<InnerLog>();
    store: BlockStore

    constructor(store: BlockStore) {
        this.store = store;
    }

    getLog<U, D, V>(name: string, model: Model<U, D, V>): Log<U, V> {
        return this.logs[name]
            || (this.logs[name] = new InnerLogImpl(model))
    }

    reset(): void {
        this.logs.values()
            .forEach(l => l.reset());
    }

    async commit(): Promise<void> {

        const beginCommit = (key: string) => this.logs[key]; 

        const toCommit = this.logs.entries()
                            .map(({ key, val: log }) => {
                                return [key, log.beginCommit()];
                            });


        //the interface of store has to change
        //everything packaged up into one commit, please

        await this.store.save('wibble1', {});


        //and on success, we should confirm to all the logs that all is ok
        //...
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
        this.limbo = { updates: [], data: this.data };
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
