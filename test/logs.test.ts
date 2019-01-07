import { Log } from "../lib/bits";
import FakeBlockStore from "./fakes/FakeBlockStore";
import FakeManifestStore from "./fakes/FakeManifestStore";
import { enumerate } from "../lib/utils";
import { testModel, AddUp, addUp } from "./fakes/testModel";
import { LogSpace, createLogSpace } from "../lib/LogSpace";


describe('LogSpace', () => {

    let logSpace: LogSpace;
    let log: Log<AddUp, string>;
    let blockStore: FakeBlockStore;
    let manifestStore: FakeManifestStore;
    let model = testModel;
    let getLog: (name?: string) => Log<AddUp, string>;

    beforeEach(() => {
        blockStore = new FakeBlockStore();
        manifestStore = new FakeManifestStore();
        logSpace = createLogSpace(blockStore, manifestStore, null);
        getLog = (name: string) => logSpace.getLog(name || 'test', testModel);
        log = getLog();
    })

    it('logs aggregates staged updates into view', async () => {
        log.stage(addUp(0, '1'));
        log.stage(addUp(1, '2'));
        log.stage(addUp(2, '3'));

        const view = await log.view();
        expect(view).toBe('1:2:3');
    })

    it('using same log key gets same log', async () => {
        const log1 = getLog('hello');
        log1.stage(addUp(0, '123'));
        log1.stage(addUp(1, '456'));        

        const log2 = getLog('hello');
        const view = await log2.view();

        expect(view).toBe('123:456');
    })


    describe('logSpace commits and resets', () => {

        describe('after reset', () => {
            it('resets to zero', async () => {
                log.stage(addUp(0, '9'));
                log.stage(addUp(1, '8'));
                logSpace.reset();
    
                const view = await log.view();
                expect(view).toBe('');
            })
        })

        describe('during and after commit', () => {
            beforeEach(() => {
                blockStore.manualResponse = true;
            })

            it('aggregated data stays same', async () => {
                log.stage(addUp(0, '5'));
                log.stage(addUp(1, '5'));
                expect(await log.view()).toBe('5:5');

                const committing = logSpace.commit();
                expect(await log.view()).toBe('5:5');

                blockStore.respond();
                await committing;
                expect(await log.view()).toBe('5:5');
            })
        })

        describe('multiple sequential commits', () => {

            it('data remains as it should be', async () => {
                log.stage(addUp(0, '1'));
                await logSpace.commit();

                log.stage(addUp(1, '2'));
                await logSpace.commit();

                expect(await log.view()).toBe('1:2');
            })

        })


        describe('on commit', () => {

            beforeEach(async () => {
                log.stage(addUp(0, '4'));
                log.stage(addUp(1, '5'));
                await logSpace.commit();
            })

            it('stores block', () => {
                const [_, block] = enumerate(blockStore.blocks).pop();
                expect(block[log.key]).toEqual([ '4', '5' ]);
            })

            it('stores manifest, referring to stored block', () => {
                const blocks = manifestStore.saved.logs[log.key];
                expect(blocks).toBeDefined();
                expect(blocks.length).toBe(1);

                const blockRef = blocks[0];
                expect(blockStore.blocks[blockRef]).toHaveProperty(log.key, [ '4', '5' ]);
            })

            it('increments manifest version', () => {
                expect(manifestStore.saved.version).toBe(1);
            })

        })


        // it('commits and loads updates', async () => {
        //     const space1 = createLogSpace(blockStore, manifestStore);
        //     const log1 = space1.getLog('hello', model);
        //     log1.stage(addUp(0, '123'));
        //     log1.stage(addUp(1, '456'));
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

            it('staged updates left in place', async () => {
                log.stage(addUp(0, '999'));
                log.stage(addUp(1, '1'));

                try { await logSpace.commit(); }
                catch {}

                const view = await log.view();
                expect(view).toBe('999:1');
            })
        })

    })

})
