import { LogSpace, Log, declareModel } from "../lib/bits";

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
        log = logSpace.getLog('test', testModel);
        console.log('LOG', log);
    })

    it('aggregates staged updates into view', async () => {
        log.stage('1');
        log.stage('2');
        log.stage('3');

        const view = await log.view();
        expect(view).toBe(6);
    })

    it('resets to start', async () => {
        log.stage('9');
        log.stage('8');
        log.reset();

        const view = await log.view();
        expect(view).toBe(0);
    })


})


