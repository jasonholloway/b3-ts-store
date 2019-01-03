import { declareModel } from "../../lib/bits";
import { declareUpdate } from "../../lib/utils";

export const testModel = declareModel({
    zero: [],
    add(data: number[], [v, t, num]: AddUp) {
        switch(t) {
            case 'ADD':
                return data.concat([parseInt(num)]);
            default:
                throw Error('Strange update!');
        }
    },
    view(data) {
        return data.join(':');
    }
})

export const addUp = declareUpdate('ADD').withData<string>();
export type AddUp = ReturnType<typeof addUp>
