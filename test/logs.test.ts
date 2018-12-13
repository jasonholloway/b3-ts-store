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
    let log: Log<string, number>;

    beforeEach(() => {
        logSpace = new LogSpace();
    })

    describe('simple', () => {
        beforeEach(() => {
            log = logSpace.getLog('test', testModel, new FakeStore());
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
        let store: Store<string>;

        beforeEach(() => {
            store = new FakeStore();
        });


        it('updates persisted', async () => {
            const log1 = logSpace.getLog('test', testModel, store);
            log1.stage('123');
            log1.stage('456');
            await log1.commit();

            const log2 = logSpace.getLog('test', testModel, store);
            await log2.load();
            const view = await log2.view();

            expect(view).toBe(123 + 456);
        })

    })

})



class FakeStore<U> implements Store<U> {

    data: U[] = [];

    async readAll(name: string): Promise<U[]> {
        return this.data;
    }

    async persist(name: string, batch: U[]): Promise<void> {
        this.data.push(...batch);
    }
}


