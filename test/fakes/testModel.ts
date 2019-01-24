import { declareLogModel } from "../../lib/bits";
import { declareUpdate } from "../../lib/utils";

export const testLogModel = declareLogModel({
    zero: [],
    add(data: number[], [v, t, num]: AddUp) {
        switch(t) {
            case 'ADD':
                return data.concat([parseInt(num)]);
            default:
                throw Error('Strange update!');
        }
    },
    // view(data) {
    //     return data.join(':');
    // }
})




const logModel = {
    zero: '',
    add: (ac: string, v: number) => 
        ac == '' ? v.toString() : (ac + ',' + v)
};

export class TestModel {
    logs = {
        myLog: logModel,
        myLog2: logModel,
        myLog3: logModel,
        myLog4: logModel
    }
}


export const addUp = declareUpdate('ADD').withData<string>();
export type AddUp = ReturnType<typeof addUp>
