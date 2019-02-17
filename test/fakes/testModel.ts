import { declareUpdate } from "../../lib/utils";
import { empty, of } from "rxjs";
import { ModelBuilder } from '../../lib/model'

const logModel = {
    zero: '',
    add: (ac: string, v: number) => 
        ac == '' ? v.toString() : (ac + ',' + v)
};



export const addUp = declareUpdate('ADD').withData<string>();
export type AddUp = ReturnType<typeof addUp>

const logModel2 = {
    zero: '',
    add: (ac: string, [_, body]: AddUp) =>
        ac == '' ? body : (ac + ':' + body)
}

export const testModel = 
    ModelBuilder.default
        .log('a', logModel)
        .log('b', logModel)
        .log('myLog', logModel)
        .log('myLog2', logModel)
        .log('myLog3', logModel)
        .log('myLog4', logModel)
        .log('test', logModel2)
        .log('hello', logModel2)
        .log('derivable', logModel)
        .log('derived', logModel)
        .derive('a', n => empty())
        .derive('b', u => of('poo'))
        .done();
