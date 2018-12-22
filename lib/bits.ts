import { Dict, getOrSet, enumerate, tup } from "./utils";
import { Observable, merge, Subject, from, Observer } from 'rxjs'
import { withLatestFrom, filter, reduce, flatMap, map } from 'rxjs/operators'

export function declareModel<U extends AnyUpdate, D, V>(m: Model<U, D, V>): Model<U, D, V> {
    return m;
}

export type Model<U extends AnyUpdate, D, V> = {
    zero: D,
    add(data: D, update: U): D,
    view(data: D): V
}


export interface Log<U extends AnyUpdate, V> {
    key: string,
    stage(update: U): void;
    load(): Promise<void>;
    view(): Promise<V>;
}



export type Block = {
    [keys: string]: AnyUpdate[]
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

export type Update<T extends string, V> = [number, T, V]
export type AnyUpdate = Update<string, any>

export type InferUpdateType<U> = U extends Update<infer UT, infer UB> ? UT : never;
export type InferUpdateBody<U> = U extends Update<infer UT, infer UB> ? UB : never;



export interface LogSpace {
    getLog<U extends AnyUpdate, D, V>(key: string, model: Model<U, D, V>): Log<U, V>;
    commit(): Promise<void>;
    reset(): void;
}



export function createLogSpace(blockStore: BlockStore, manifestStore: ManifestStore): LogSpace {
    let version = 0;
    let logs: { [key: string]: InnerLog } = {}

    const innerLogs = new Subject<Dict<InnerLog>>();
    const manifests = new Subject<Manifest>();


    const commits = new Subject<number>();
    let nextCommitId = 1;
    

    //the manifests stream should be combined with a logs stream
    //to give a stream of latest 


    //create a block
    //create a new manifest


    const newBlocks = innerLogs.pipe(
        flatMap(m => {
            const logs = from(enumerate(m));
            return logs.pipe(
                map(([key, log]) => log.staged)
            );
        })
    )

    commits.pipe(
        withLatestFrom(manifests, innerLogs),
        map(([cid, manifest, innerLogs]) => {
            const confirm = new Subject<LogSpec>();

            from(enumerate(innerLogs)).pipe(
                reduce<[string, InnerLog], Block>(
                    (block, [key, log]) => 
                    ({

                    }), {})
            )
                

            const newBlock = beginCommits(innerLogs, confirm);

            const ref = `B${Math.ceil(Math.random() * 1000)}`;

            return tup(cid, manifest, tup(ref, newBlock), confirm);
        }),
        map(([cid, manifest, [blockRef, newBlock], confirm]) => {
            
            const newSpecs = enumerate(manifest.logs)
                                .reduce(
                                    (ac, [key, blocks]) => 
                                        ({  ...ac, [key]: blocks }), 
                                    {} as Dict<LogBlocks>);

            const newManifest = {
                version: manifest.version + 1,
                logs: newSpecs
            };

            return tup(cid, newManifest, tup(blockRef, newBlock), confirm);
        })
    );

    function beginCommits(logs: Dict<InnerLog>, confirm: Observable<LogSpec>): Block {
        return enumerate(logs)
                .reduce(
                    (block, [key, log]) => 
                        ({ ...block, [key]: log.beginCommit(confirm) }), 
                    {} as Block);
    }


        // flatMap(async ([cid, manifest, innerLogs]) => {

        //     const confirm = new Subject<LogSpec>();

        //     const newBlock = enumerate(innerLogs)
        //                         .reduce(
        //                             (block, [key, log]) => 
        //                                 ({ ...block, [key]: log.beginCommit(confirm) }), 
        //                             {} as Block);
        
        //     const blockRef = `B${Math.ceil(Math.random() * 1000)}`;

        //     await this.blockStore.save(blockRef, newBlock); //should do gazump-check before this...

        //     const specs = enumerate(manifest.logs)
        //                     .reduce<Dict<LogBlocks>>(
        //                         (ac, [key, blocks]) => ({ 
        //                             ...ac, 
        //                             [key]: blocks
        //                         }), {});

        //     const newManifest = {
        //         version: this.version + 1,
        //         logs: specs
        //     }

        //     await this.manifestStore.save(newManifest);

        //     confirm.next(null); //publish new spec as confirmation
                    

            

        //     return [];
        // })
    

        
    async function doCommit(): Promise<void> {        
        const confirm = new Subject<LogSpec>();

        try {
            const block = enumerate(logs)
                            .reduce(
                                (block, [key, log]) => 
                                    ({ ...block, [key]: log.beginCommit(confirm) }), 
                                {} as Block);
            
            const blockRef = `B${Math.ceil(Math.random() * 1000)}`;
        
            await this.blockStore.save(blockRef, block); //should do gazump-check before this...

            const logBlocks = enumerate(logs)
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

            confirm.next(null); //publish new spec as confirmation

            //and more generally publish???
        }
        catch(err) {
            confirm.error(err);
            throw err;
        }
        finally {
            confirm.complete();
        }
    }



    return {
        getLog<U extends AnyUpdate, D, V>(key: string, model: Model<U, D, V>): Log<U, V> {
            return getOrSet(this.logs, key, () => createInnerLog(key, model, null));
        },

        reset(): void {
            enumerate(this.logs)
                .forEach(([_, l]) => l.reset());
        },


        
        //logSpecs are always coming in
        //committing requires us to get the latest manifest (it will have been initially seeded of course...)
        //I mean, you don't want to get the latest, cos that's some fruity misappropriation of rx
        //instead of polling for the latest ad hoc, the latest frame should be our current context

        //and the frame will know everything about its current configuration
        //
        //but the client Logs will be the same; the BlockCache will remain the same also
        //but the bit in the middle will change with time
        //a Frame has mappings of blocks to logs
        //
        //so, we start from a frame, but committing actually gathers together everything from various places
        //well, it takes things from the logs, and stores things into the BlockStore: all of which are non-streamy
        //
        //the user will have a handle on the LogSpace, inside of which will be streams; LogSpace will be a harness for streams
        //so the user will call commit
        //but internally, the commit must adapt itself to a certain Frame
        //the latest Frame should be used to do everything, everything should be bound to the single instance
        //in effect the user is sending a 'commit' impulse into the system: this could be implemented itself as a stream
        //
        //so we will have a stream of commit impulses, then
        //and as these commits are effected, new LogSpecs will be sent out, and all LogHandles will announce the availability of new data
        //but we can't serve up all that data eagerly: it has to be specifically requested.
        //but if we don't know what the new updates are, how can we know whether they fit the current updates or not?
        //
        //as soon as we know there's more data to fetch, then - if the handle exists, we should pull that new data down
        //but that pulling down is to be done by the Log rather than the Space
        //the Space just distributes new Specs
        //
        //but when we commit, the Space and the Logs meet
        //



        async commit(): Promise<void> {
            const commitId = nextCommitId++;
            commits.next(commitId);

            //wait for errors or completions
            //with corresponding commitId

            //serialize!
            //...
            //AND WHAT ABOUT ROLLBACK IN EVENT OF A FAILURE?????????????!!!!!

            //but...
            //cancelCommits should be called on all logs here
            //not just the affected ones

            //plus: what'd happen if we cancelled a limbo that wasn't our own? 
            //it wouldn't be a problem, as long as the attempt at committing is also thrown out
        }
    };
}



interface InnerLog {
    reset(): void
    beginCommit(result: Observable<LogSpec>): AnyUpdate[]
    cancelCommits(): void

    staged: Observable<AnyUpdate[]>

}


//but instead of receiving raw updates,
//we really want to be flowing LogSpecs
//a LogSpec would know what version it was on, for instance (more info than just block map)
//(blocks may change, versions shouldn't)
//so: new LogSpecs should flow through
//and they will render staged updates invalid if need be
//
//when we commit at the level of the LogSpace
//then stageds are limboed, and we wait for confirmation
//the usual routine, really
//if the commit is successful, the log should be told to apply the limboed updates
//then a new LogSpec will come through, that won't upset us one bit, as we will be up to date
//
//-----
//
//except that we will need to be sure that the LogSpec is only published *after* confirmation of the commit by the Log
//this seesm like the natural order of things
//


type LogSpec = {
    head: number,
    blocks: BlockRef[]
}

function createInnerLog<U extends AnyUpdate, D, V>(key: string, model: Model<U, D, V>, specs: Observable<LogSpec>, stagedSink: Observer<U[]>): InnerLog & Log<U, V> {

    let spec: LogSpec = { head: 0, blocks: [] }
    let aggr = model.zero;
    

    specs.subscribe(s => {
        spec = s; //really this should cascade on to calculate other data
    });

    const staged = new Subject<U[]>();
    staged.subscribe(stagedSink);

    return {
        key,

        stage(update: U): void {
            staged.next(update);
            // staged.aggr = model.add(staged.aggr, update);
            // staged.updates.push(update);
        },

        reset(): void {
            staged = { updates: [], aggr };
        },


        staged,


        /**
         * if confirmCommit is called, we can be sure that our previously-limboed updates 
         * have been persisted to block and manifest; so we now need to shuffle up
         */
        beginCommit(result: Observable<LogSpec>): U[] {
            const pending = staged.updates;

            limbos.push({
                updates: pending,
                aggr: staged.aggr
            });

            staged.updates = [];

            result.subscribe(committedSpecs);

            return pending;
        },
        
        cancelCommits() {
            //...
        },

        async load(): Promise<void> {
            //if the blocks aren't populated, we should populate em
            //how can we know they've been populated?
            //
            //well, first of all: they've been set at all
            //then we know there's something at least in place
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
