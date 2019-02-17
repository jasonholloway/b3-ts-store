import FakeBlockStore from "./fakes/FakeBlockStore";
import FakeManifestStore from "./fakes/FakeManifestStore";
import { propsToArray } from "../lib/utils";
import { addUp, testModel } from "./fakes/testModel";
import { LogSpace, createLogSpace, Log } from "../lib/LogSpace";
import { pause } from "./utils";
import { Observable } from "rxjs";
import { pullAll } from "../lib/core/eraSlicer";
import { first, timeout } from "rxjs/operators";
import { gather } from "./helpers";
import { KnownLogs } from "../lib/model";

jest.setTimeout(400);

describe('logSpace', () => {

    let space: LogSpace<typeof testModel>;

    let log: Log<typeof testModel, any, string>;
    let blockStore: FakeBlockStore;
    let manifestStore: FakeManifestStore;
    
    beforeEach(async () => {
        blockStore = new FakeBlockStore();
        manifestStore = new FakeManifestStore();

        space = createLogSpace(testModel, manifestStore, blockStore);
        log = space.getLog('test');
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

    it('derivations updated', async () => {
        const derivable = getLog('derivable');
        const derived = getLog('derived');

        derivable.stage('wibble');
        derivable.stage('parp');
        derivable.stage('wooo!');

        const derivedView = await latest(derived.view$);
        expect(derivedView).toEqual('wpw');
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
                log.stage(addUp('1'));
                log.stage(addUp('2'));
                expect(await view(log)).toBe('1:2');

                const committing = space.commit();
                expect(await view(log)).toBe('1:2');

                blockStore.respond();
                await committing.toPromise();

                expect(await view(log)).toBe('1:2');
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

            describe('many competing commits', () => {

                let view$: Observable<string>

                beforeEach(async () => {
                    view$ = log.view$.pipe(pullAll());

                    log.stage(addUp('1'));
                    space.commit();

                    log.stage(addUp('2'));
                    space.commit();
                    space.commit();

                    await pause();
                    complete();
                    await pause();
                })

                it('local view uses all ripples', async () => 
                    expect(await gather(view$))
                        .toEqual(['' , '1', '1:2', '1:2']));

                it('only first commit goes through', () =>
                    expect(manifestStore.manifest.logBlocks[log.ref].length).toBe(1));
            })


            describe('many competing commits with slow push', () => {

                let view$: Observable<string>

                beforeEach(async () => {
                    view$ = log.view$.pipe(pullAll());

                    manifestStore.delay = 50;

                    log.stage(addUp('1'));
                    space.commit();

                    log.stage(addUp('2'));
                    space.commit();
                    space.commit();

                    await pause(50);
                    complete();
                })

                it('local view uses all ripples', async () => 
                    expect(await gather(view$))
                        .toEqual(['' , '1', '1:2', '1:2']));

                it('only first commit goes through', () =>
                    expect(manifestStore.manifest.logBlocks[log.ref].length).toBe(1));
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
                const [[, block]] = propsToArray(blockStore.blocks);
                
                expect(block[log.ref]).toEqual([ 
                    ['ADD', '4'], 
                    ['ADD', '5'] 
                ]);
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
                await pause();
            })

            it('full view summoned', async () => {
                const space2 = createLogSpace(testModel, manifestStore, blockStore);
                const log2 = space2.getLog(log.ref);
                
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



    function getLog<K extends KnownLogs<typeof testModel>>(logRef?: K) {
        return space.getLog(logRef || 'test');
    }

    function complete() {
        space.complete();
    }

    function view<V>(log: Log<typeof testModel, any, V>) {
        return latest(log.view$);
    }

    function latest<V>(o$: Observable<V>): Promise<V> {
        return o$.pipe(
                first(), 
                timeout(100),
            ).toPromise();
    }


})
