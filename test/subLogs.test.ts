import { declareModel, LogSpace, Log, Model } from "../lib/bits";
import { FakeStore } from "./fakes/FakeStore";

type SubLogUpdate = {

}

type SubLogSpaceView = {

}


class SubLogSpace {

    log: Log<SubLogUpdate, SubLogSpaceView>

    constructor(log: Log<SubLogUpdate, SubLogSpaceView>) {
        this.log = log;
    }

    getSubLog<U extends SubLogUpdate, D, V>(name: string, model: Model<U, D, V>): SubLog<U, V> {
        //and now: we want to specify our model exactly here (do we?)
        //
        //
        
        throw Error('WIP');
    }
}

interface SubLog<U, V> {
    stage(update: U): void;
    view(): Promise<V>;
}

class SubLogImpl<U, D, V> implements SubLog<U, V> {

    model: Model<U, D, V>
    data: D
    log: Log<U, V>

    constructor(model: Model<U, D, V>, log: Log<U, V>) {
        this.model = model;
        this.data = model.zero;        
    }

    stage(update: U): void {
        this.staged.data = this.model.add(this.staged.data, update);
        this.staged.updates.push(update);
    }

    async view(): Promise<V> {
        return this.model.view(this.staged.data);
    }
}


const subLogSpaceModel = declareModel({
    zero: 0,
    add(data, update) {
        return data;
    },
    view(data) {
        throw Error('WIP');
    }
});



describe('subLogs', () => {

    let store: FakeStore<any>;

    beforeEach(() => {
        store = new FakeStore();
    })

    it('can get a subLog', async () => {
        const logSpace = new LogSpace();
        const log = logSpace.getLog('test', subLogSpaceModel, store);

        const subLogSpace = new SubLogSpace(log);

        const subLog = subLogSpace.getSubLog('', null);


    })

    
})