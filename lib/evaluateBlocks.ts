import { Model, Evaluable } from "./evaluateSlices";
import { OperatorFunction, pipe, empty } from "rxjs";
import { BlockFrame } from "./pullBlocks";
import { map } from "rxjs/operators";

export const evaluateBlocks = 
    <M extends Model>(model: M) : OperatorFunction<BlockFrame, Evaluable<M>> =>
    pipe(
        map(({load}) => {



            return {
                evaluate: () => null,
                logRefs: empty()
            }
        })
    );

