import { Log } from "../lib/bits";
import FakeBlockStore from "./fakes/FakeBlockStore";
import FakeManifestStore from "./fakes/FakeManifestStore";
import { enumerate } from "../lib/utils";
import { testLogModel, AddUp, addUp, TestModel } from "./fakes/testModel";
import { LogSpace, createLogSpace } from "../lib/LogSpace";


describe('logSpace', () => {

    const model = new TestModel();

    let space: LogSpace<TestModel>;

    let log: Log<AddUp, string>;
    let blocks: FakeBlockStore;
    let manifests: FakeManifestStore;
    let getLog: (name?: string) => Log<AddUp, string>;

    beforeEach(() => {
        blocks = new FakeBlockStore();
        manifests = new FakeManifestStore();

        space = createLogSpace(model, manifests, blocks);

        getLog = (name: string) => space.getLog(name || 'test', testLogModel);
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
                space.reset();
    
                const view = await log.view();
                expect(view).toBe('');
            })
        })

        describe('during and after commit', () => {
            beforeEach(() => {
                blocks.manualResponse = true;
            })

            it('aggregated data stays same', async () => {
                log.stage(addUp(0, '5'));
                log.stage(addUp(1, '5'));
                expect(await log.view()).toBe('5:5');

                const committing = space.commit();
                expect(await log.view()).toBe('5:5');

                blocks.respond();
                await committing;
                expect(await log.view()).toBe('5:5');
            })
        })

        describe('multiple sequential commits', () => {

            it('data remains as it should be', async () => {
                log.stage(addUp(0, '1'));
                await space.commit();

                log.stage(addUp(1, '2'));
                await space.commit();

                expect(await log.view()).toBe('1:2');
            })

        })


        describe('on commit', () => {

            beforeEach(async () => {
                log.stage(addUp(0, '4'));
                log.stage(addUp(1, '5'));
                await space.commit();
            })

            it('stores block', () => {
                const [_, block] = enumerate(blocks.blocks).pop();
                expect(block[log.key]).toEqual([ '4', '5' ]);
            })

            it('stores manifest, referring to stored block', () => {
                const blocks = manifests.manifest.logBlocks[log.key];
                expect(blocks).toBeDefined();
                expect(blocks.length).toBe(1);

                const blockRef = blocks[0];
                expect(blocks.blocks[blockRef]).toHaveProperty(log.key, [ '4', '5' ]);
            })

            it('increments manifest version', () => {
                expect(manifests.manifest.version).toBe(1);
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
                blocks.errorsOnPersist = true;
            })

            it('staged updates left in place', async () => {
                log.stage(addUp(0, '999'));
                log.stage(addUp(1, '1'));

                try { await space.commit(); }
                catch {}

                const view = await log.view();
                expect(view).toBe('999:1');
            })
        })

    })

})
