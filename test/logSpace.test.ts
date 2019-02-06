import FakeBlockStore from "./fakes/FakeBlockStore";
import FakeManifestStore from "./fakes/FakeManifestStore";
import { propsToArray } from "../lib/utils";
import { addUp, TestModel } from "./fakes/testModel";
import { LogSpace, createLogSpace, Log } from "../lib/LogSpace";
import { KnownLogs } from "../lib/core/evaluable";
import { pause } from "./utils";
import { Observable } from "rxjs";
import { Commit } from "../lib/core/committer";
import { pullAll } from "../lib/core/eraSlicer";
import { first, timeout } from "rxjs/operators";
import { gather } from "./helpers";

jest.setTimeout(400);

describe('logSpace', () => {

    const model = new TestModel();

    let space: LogSpace<TestModel>;

    let log: Log<TestModel, any, string>;
    let blockStore: FakeBlockStore;
    let manifestStore: FakeManifestStore;
    
    let error$: Observable<Error>
    let commit$: Observable<Commit>

    beforeEach(() => {
        blockStore = new FakeBlockStore();
        manifestStore = new FakeManifestStore();

        space = createLogSpace(model, manifestStore, blockStore);
        log = getLog();

        error$ = space.error$.pipe(pullAll());
        commit$ = space.commit$.pipe(pullAll());
    })

    afterEach(complete);

    it('logs aggregates staged updates into view', async () => {
        log.stage(addUp('1'));
        log.stage(addUp('2'));
        log.stage(addUp('3'));

        expect(await view(log))
            .toBe('1:2:3');
    })

    it('using same log key gets same log', async () => {
        const log1 = getLog('hello');
        log1.stage(addUp('123'));
        log1.stage(addUp('456'));        

        const log2 = getLog('hello');

        expect(await view(log2))
            .toBe('123:456');
    })


    describe('logSpace commits and resets', () => {

        describe('after reset', () => {
            it('resets to zero', async () => {
                log.stage(addUp('1'));
                log.stage(addUp('2'));
                space.reset();
    
                expect(await view(log))
                    .toBe('');
            })
        })

        describe('during and after commit', () => {
            beforeEach(() => {
                blockStore.manualResponse = true;
            })

            it('aggregated data stays same', async () => {
                log.stage(addUp('5'));
                log.stage(addUp('5'));
                expect(await view(log)).toBe('5:5');

                const committing = space.commit();
                expect(await view(log)).toBe('5:5');

                blockStore.respond();
                await committing;
                expect(await view(log)).toBe('5:5');
            })
        })

        describe('multiple sequential commits', () => {

            it('data remains as it should be', async () => {
                log.stage(addUp('1'));
                await space.commit();

                log.stage(addUp('2'));
                await space.commit();

                expect(await view(log)).toBe('1:2');
            })

        })


        describe('on commit', () => {

            beforeEach(async () => {
                log.stage(addUp('4'));
                log.stage(addUp('5'));
                space.commit();
                await pause();
            })

            it('stores block', async () => {
                const [[_, block]] = propsToArray(blockStore.blocks);
                
                expect(block[log.ref]).toEqual([ 
                    ['ADD', '4'], 
                    ['ADD', '5'] 
                ]);           //currently only storing first slice!
            })

            it('stores manifest, referring to stored block', () => {
                const blocks = manifestStore.manifest.logBlocks[log.ref];
                expect(blocks).toBeDefined();
                expect(blocks.length).toBe(1);

                const blockRef = blocks[0];
                expect(blockStore.blocks[blockRef])
                    .toHaveProperty(log.ref, [ 
                        ['ADD', '4'], 
                        ['ADD', '5'] 
                     ]);
            })

            it('increments manifest version', () => {
                expect(manifestStore.manifest.version).toBe(1);
            })
        })


        describe('after multiple commits', () => {
            beforeEach(async () => {
                log.stage(addUp('1'));
                space.commit();
                await pause();

                log.stage(addUp('2'));
                space.commit();
            })

            it('full view summoned', async () => {
                const space2 = createLogSpace(model, manifestStore, blockStore);
                const log2 = space2.getLog(log.ref);

                console.log(manifestStore.manifest)
                
                expect(await view(log2))
                    .toEqual('1:2');
            })

            //problem above is that staged updates aren't cleared in time on commit...
            //so second commit includes first slice...
            //
            //when commit succeeds, should update thresh at same time as pulling new manifest
            //but the two commands don't even go to the same place: 

        })


        // it('commits and loads updates', async () => {
        //     const space1 = createLogSpace(blockStore, manifestStore);
        //     const log1 = space1.getLog('hello', model);
        //     log1.stage(addUp('123'));
        //     log1.stage(addUp('456'));
        //     await logSpace.commit();

        //     const space2 = createLogSpace(blockStore, manifestStore);
        //     const log2 = space2.getLog('hello', model);
        //     await log2.load();
        //     const view = await log2.view();

        //     expect(view).toBe(123 + 456);
        // })

        it('multiple in-flight commits', () => {    
            //store will guarantee... something
        })


        describe('on commit failure', () => {

            beforeEach(() => {
                blockStore.errorsOnPersist = true;
            })

            it('error streamed back to caller', async () => {
                log.stage('1');
                const messages = await gather(space.commit());
                expect(messages[0]).toBeInstanceOf(Error);
            })

            it('staged updates left in place', async () => {
                log.stage(addUp('999'));
                log.stage(addUp('1'));
                space.commit();
                await pause();

                expect(await view(log))
                    .toBe('999:1');
            })
        })

    })



    function getLog<K extends KnownLogs<TestModel>>(logRef?: K) {
        return space.getLog(logRef || 'test');
    }

    function complete() {
        space.complete();
    }

    function view<V>(log: Log<TestModel, any, V>) {
        return latest(log.view$);
    }

    function latest<V>(o$: Observable<V>): Promise<V> {
        return o$.pipe(
                first(), 
                timeout(100)
            ).toPromise();
    }


})
