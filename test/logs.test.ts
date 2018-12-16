import { LogSpace, Log, declareModel, Store } from "../lib/bits";
import FakeBlockStore from "./fakes/FakeBlockStore";

const testModel = declareModel({
    zero: [],
    add(data: number[], up: string) {
        return data.concat([parseInt(up)]);
    },
    view(data) {
        return data.reduce((ac, v) => ac + v, 0);
    }
})

describe('LogSpace', () => {

    let logSpace: LogSpace;
    let log: Log<string, number>;
    let store: FakeBlockStore;
    let model = testModel;
    let getLog: (name?: string) => Log<string, number>;

    beforeEach(() => {
        store = new FakeBlockStore();
        logSpace = new LogSpace(store);
        getLog = (name: string) => logSpace.getLog(name || 'test', testModel);
        log = getLog();
    })

    it('logs aggregates staged updates into view', async () => {
        log.stage('1');
        log.stage('2');
        log.stage('3');

        const view = await log.view();
        expect(view).toBe(6);
    })

    it('using same log key gets same log', async () => {
        const log1 = getLog('hello');
        log1.stage('123');
        log1.stage('456');        

        const log2 = getLog('hello');
        const view = await log2.view();

        expect(view).toBe(123 + 456);
    })


    describe('logSpace commits and resets', () => {

        describe('after reset', () => {
            it('resets to zero', async () => {
                log.stage('9');
                log.stage('8');
                logSpace.reset();
    
                const view = await log.view();
                expect(view).toBe(0);
            })
        })

        describe('during and after commit', () => {
            beforeEach(() => {
                store.manualResponse = true;
            })

            it('aggregated data stays same', async () => {
                log.stage('5');
                log.stage('5');
                expect(await log.view()).toBe(10);

                const committing = logSpace.commit();
                expect(await log.view()).toBe(10);

                store.respond();
                await committing;
                expect(await log.view()).toBe(10);
            })
        })

        describe('multiple sequential commits', () => {

            it('data is committed', async () => {
                log.stage('1');
                await logSpace.commit();

                log.stage('2');
                await logSpace.commit();

                expect(await log.view()).toBe(3);
            })

        })


        it('commits and loads updates', async () => {
            const log1 = logSpace.getLog('hello', model);
            log1.stage('123');
            log1.stage('456');
            await logSpace.commit();

            const logSpace2 = new LogSpace(store);
            const log2 = logSpace2.getLog('hello', model);
            await log2.load();
            const view = await log2.view();

            expect(view).toBe(123 + 456);
        })

        it('multiple in-flight commits', () => {
            //store will guarantee... something
        })


        describe('on commit failure', () => {

            beforeEach(() => {
                store.errorsOnPersist = true;
            })

            it('staged updates left in place', async () => {
                log.stage('999');
                log.stage('1');

                try { await logSpace.commit(); }
                catch {}

                const view = await log.view();
                expect(view).toBe(1000);
            })
        })

    })

})
