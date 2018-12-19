import { Dict, getOrSet, enumerate, tup } from "./utils";

export function declareModel<U, D, V>(m: Model<U, D, V>): Model<U, D, V> {
    return m;
}

export type Model<U, D, V> = {
    zero: D,
    add(data: D, update: U): D,
    view(data: D): V
}


export interface Log<U, V> {
    key: string,
    stage(update: U): void;
    load(): Promise<void>;
    view(): Promise<V>;
}



export type Block = {
    [keys: string]: any[]
}

export interface BlockStore {
    load(key: string): Promise<Block>;
    save(key: string, block: Block): Promise<void>;
}


export type Manifest = {
    version: number,
    logs: Dict<LogBlocks>
}

export type LogBlocks = BlockRef[]


export interface ManifestStore {
    load(): Promise<Manifest>;
    save(manifest: Manifest): Promise<void>
}



type BlockRef = string


export class LogSpace {
    
    private blockStore: BlockStore
    private manifestStore: ManifestStore

    version = 0;
    logs: { [key: string]: InnerLog } = {}


    constructor(blockStore: BlockStore, manifestStore: ManifestStore) {
        this.blockStore = blockStore;
        this.manifestStore = manifestStore;
    }

    getLog<U, D, V>(key: string, model: Model<U, D, V>): Log<U, V> {
        return getOrSet(this.logs, key, () => createInnerLog(key, model));
    }

    reset(): void {
        enumerate(this.logs)
            .forEach(([_, l]) => l.reset());
    }


    //go on then: what happens if there'sa problem after we beginCommit()?
    //well, we cancelCommits() on all logs...

    async commit(): Promise<void> { 
        //serialize!
        //...

        const [block, logs] = enumerate(this.logs)
                                .reduce<[Block, InnerLog[]]>(
                                    ([block, logs], [key, log]) => {
                                        const pending = log.beginCommit();
                                        return tup(
                                            {...block, [key]: pending}, 
                                            [...logs, log]
                                        ); 
                                    },
                                    tup({}, []))
        
        const blockRef = `B${Math.ceil(Math.random() * 1000)}`;
    
        await this.blockStore.save(blockRef, block); //should do gazump-check before this...

        const logBlocks = enumerate(this.logs)
                            .reduce<Dict<LogBlocks>>(
                                (ac, [key, log]) => ({ 
                                    ...ac, 
                                    [key]: log.blocks()
                                }), {});

        const manifest = {
            version: this.version + 1,
            logs: logBlocks
        }

        await this.manifestStore.save(manifest);

        logs.forEach(l => l.confirmCommit([blockRef]));


        //AND WHAT ABOUT ROLLBACK IN EVENT OF A FAILURE?????????????!!!!!

        //but...
        //cancelCommits should be called on all logs here
        //not just the affected ones

        //plus: what'd happen if we cancelled a limbo that wasn't our own? 
        //it wouldn't be a problem, as long as the attempt at committing is also thrown out
    }
}

//
//
//
//


interface InnerLog {
    reset(): void
    beginCommit(): any[]
    confirmCommit(refs: BlockRef[]): void
    cancelCommits(): void
    blocks(): BlockRef[]
}

type LogRef = string


type BlockBank = {
    [logKey: string]: BlockRef[]
}

type BlockCache = {
    [blockRef: string]: any[]
}


function createBlockBank(blockStore: BlockStore): BlockBank {




    return {

    };
}




function createInnerLog<U, D, V>(key: string, model: Model<U, D, V>): InnerLog & Log<U, V> {

    let aggr = model.zero;
    let limbos: { updates: U[], aggr: D }[] = [];
    let staged: { updates: U[], aggr: D } = { updates: [], aggr };
    let blocks: BlockRef[] = [];

    return {
        key,

        stage(update: U): void {
            staged.aggr = model.add(staged.aggr, update);
            staged.updates.push(update);
        },

        reset(): void {
            staged = { updates: [], aggr };
        },

        beginCommit(): U[] {
            const pending = staged.updates;

            limbos.push({
                updates: pending,
                aggr: staged.aggr
            });

            staged.updates = [];

            return pending;
        },

        confirmCommit(blockRefs: BlockRef[]) {
            blocks.push(...blockRefs);
            //and promote head of limbos
            //...
        },

        cancelCommits() {
            //...
        },

        blocks() {
            return blocks;
        },

        async load(): Promise<void> {
            //if the blocks aren't populated, we should populate em
            //how can we know they've been populated?
            //
            //well, first of all: they've been set at all
            //then we know there's something at least in place
            //
            //




            //we should know what blocks we have, at least
            //but we only do if they've been loaded from outside
            //and then, given the BlockRefs, we need to load the actual blocks, at will
            //



            //in loading,
            //we first of all want to consult the manifest
            //we shouldn't trigger any reloads of the manifest (it should have been downloaded once only)
            //
            //but the manifest is here...
            //in that we should know how many updates we should have
            //(but with compaction, the number of updates will change!)



            // const updates = await this.store.readAll('blah');
            // this.data = updates.reduce((d, u) => this.model.add(d, u), this.model.zero);
            // this.reset();
        },

        async view(): Promise<V> {
            //should load here?
            return model.view(staged.aggr);
        }
    }
}
