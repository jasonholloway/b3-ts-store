import { LogSpace, Log, declareModel, Store } from "../lib/bits";

const testModel = declareModel({
    zero: [],
    add(data: number[], up: string) {
        return data.concat([parseInt(up)]);
    },
    view(data) {
        return data.reduce((ac, v) => ac + v, 0);
    }
})

describe('LogSpace log', () => {

    let logSpace: LogSpace;
    let getLog: () => Log<string, number>;

    beforeEach(() => {
        logSpace = new LogSpace();
        getLog = () => logSpace.getLog('test', testModel, new FakeStore());
    })

    describe('simple', () => {
        let log: Log<string, number>;

        beforeEach(() => {
            log = getLog();
        })

        it('aggregates staged updates into view', async () => {
            log.stage('1');
            log.stage('2');
            log.stage('3');

            const view = await log.view();
            expect(view).toBe(6);
        })

        it('resets to zero', async () => {
            log.stage('9');
            log.stage('8');
            log.reset();

            const view = await log.view();
            expect(view).toBe(0);
        })
    })

    describe('commits', () => {
        let store: FakeStore<string>;

        beforeEach(() => {
            store = new FakeStore();
            getLog = () => logSpace.getLog('test', testModel, store);
        });

        it('updates persisted', async () => {
            const log1 = getLog();
            log1.stage('123');
            log1.stage('456');
            await log1.commit();

            const log2 = getLog();
            await log2.load();
            const view = await log2.view();

            expect(view).toBe(123 + 456);
        })

        describe('on commit failure', () => {

            beforeEach(() => {
                store.errorsOnPersist = true;
            })

            it('staged updates left in place', async () => {
                const log = getLog();
                log.stage('999');
                log.stage('1');

                try { await log.commit(); }
                catch {}

                const view = await log.view();
                expect(view).toBe(1000);
            })
        })

    })

})


class FakeStore<U> implements Store<U> {

    data: U[] = [];
    errorsOnPersist = false;

    async readAll(name: string): Promise<U[]> {
        return this.data;
    }

    async persist(name: string, batch: U[]): Promise<void> {
        if(this.errorsOnPersist) {
            throw Error('ErrorsOnPersist');
        }

        this.data.push(...batch);
    }
}


