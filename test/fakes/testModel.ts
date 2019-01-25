import { declareUpdate } from "../../lib/utils";


const logModel = {
    zero: '',
    add: (ac: string, v: number) => 
        ac == '' ? v.toString() : (ac + ',' + v)
};

const logModel2 = {
    zero: '',
    add: (ac: string, [_, body]: AddUp) =>
        ac == '' ? body : (ac + ':' + body)
}


export class TestModel {
    logs = {
        myLog: logModel,
        myLog2: logModel,
        myLog3: logModel,
        myLog4: logModel,

        test: logModel2,
        hello: logModel2
    }
}


export const addUp = declareUpdate('ADD').withData<string>();
export type AddUp = ReturnType<typeof addUp>
