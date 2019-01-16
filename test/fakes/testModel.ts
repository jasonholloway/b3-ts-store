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



export class TestModel {
    logs = {
        myLog: {
            zero: '',
            add: (ac: string, v: number) => 
                ac == '' ? v : (ac + ',' + v)
        },
        myLog2: {
            zero: '',
            add: (ac: string, v: number) => 
                ac == '' ? v : (ac + ',' + v)
        }
    }
}


export const addUp = declareUpdate('ADD').withData<string>();
export type AddUp = ReturnType<typeof addUp>
