import { declareUpdate } from "../../lib/utils";
import { Model } from "../../lib/core/evaluable";
import { Log } from "../../lib/LogSpace";


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
        a: logModel,
        b: logModel,

        myLog: logModel,
        myLog2: logModel,
        myLog3: logModel,
        myLog4: logModel,

        test: logModel2,
        hello: logModel2
    }

    //a derivation will select by type
    //we want typed logs, instead of singular ones
    //before we can specify derivations

    //so the derivation will occur on staging from a well-known, exposed log
    //
    //
    
    derivations = {

    }
}


export const addUp = declareUpdate('ADD').withData<string>();
export type AddUp = ReturnType<typeof addUp>
