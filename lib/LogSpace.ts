import { AnyUpdate, Model, Log, BlockStore, ManifestStore, Manifest, Block } from "./bits";
import { Subject, from, Observable, Observer } from "rxjs";
import { Dict, enumerate, tup, getOrSet } from "./utils";
import { flatMap, map, withLatestFrom, reduce } from "rxjs/operators";
import { InnerLog, createLogMachine, createLogFacade } from "./Log";


export interface LogSpace {
    getLog<U extends AnyUpdate, D, V>(key: string, model: Model<U, D, V>): Log<U, V>;
    commit(): Promise<void>;
    reset(): void;
}


type BlockRef = string
export type LogBlocks = BlockRef[]



export type LogSpec = {
    head: number,
    blocks: BlockRef[]
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

    // commits.pipe(
    //     withLatestFrom(manifests, innerLogs),
    //     map(([cid, manifest, innerLogs]) => {
    //         const confirm = new Subject<LogSpec>();

    //         from(enumerate(innerLogs)).pipe(
    //             reduce<[string, InnerLog], Block>(
    //                 (block, [key, log]) => 
    //                 ({

    //                 }), {})
    //         )
                

    //         const newBlock = beginCommits(innerLogs, confirm);

    //         const ref = `B${Math.ceil(Math.random() * 1000)}`;

    //         return tup(cid, manifest, tup(ref, newBlock), confirm);
    //     }),
    //     map(([cid, manifest, [blockRef, newBlock], confirm]) => {
            
    //         const newSpecs = enumerate(manifest.logs)
    //                             .reduce(
    //                                 (ac, [key, blocks]) => 
    //                                     ({  ...ac, [key]: blocks }), 
    //                                 {} as Dict<LogBlocks>);

    //         const newManifest = {
    //             version: manifest.version + 1,
    //             logs: newSpecs
    //         };

    //         return tup(cid, newManifest, tup(blockRef, newBlock), confirm);
    //     })
    // );

    // function beginCommits(logs: Dict<InnerLog>, confirm: Observable<LogSpec>): Block {
    //     return enumerate(logs)
    //             .reduce(
    //                 (block, [key, log]) => 
    //                     ({ ...block, [key]: log.beginCommit(confirm) }), 
    //                 {} as Block);
    // }


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
    

        
    // async function doCommit(): Promise<void> {        
    //     const confirm = new Subject<LogSpec>();

    //     try {
    //         const block = enumerate(logs)
    //                         .reduce(
    //                             (block, [key, log]) => 
    //                                 ({ ...block, [key]: log.beginCommit(confirm) }), 
    //                             {} as Block);
            
    //         const blockRef = `B${Math.ceil(Math.random() * 1000)}`;
        
    //         await this.blockStore.save(blockRef, block); //should do gazump-check before this...

    //         const logBlocks = enumerate(logs)
    //                             .reduce<Dict<LogBlocks>>(
    //                                 (ac, [key, log]) => ({ 
    //                                     ...ac, 
    //                                     [key]: log.blocks()
    //                                 }), {});

    //         const manifest = {
    //             version: this.version + 1,
    //             logs: logBlocks
    //         }

    //         await this.manifestStore.save(manifest);

    //         confirm.next(null); //publish new spec as confirmation

    //         //and more generally publish???
    //     }
    //     catch(err) {
    //         confirm.error(err);
    //         throw err;
    //     }
    //     finally {
    //         confirm.complete();
    //     }
    // }


    return {
        getLog<U extends AnyUpdate, D, V>(key: string, model: Model<U, D, V>): Log<U, V> {
            const entry = getOrSet(logs, key, () => { 
                return createLogFacade(key, model, null, null);
            });
            return entry;
        },

        reset(): void {
            // enumerate(this.logs)
                // .forEach(([_, l]) => l.reset());
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
