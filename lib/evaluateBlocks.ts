import { Model } from "./evaluateSlices";
import { OperatorFunction, pipe } from "rxjs";
import { BlockFrame } from "./pullBlocks";
import { map } from "rxjs/operators";

export const evaluateBlocks = 
    <M extends Model>(model: M) : OperatorFunction<BlockFrame, BlockFrame> =>
    pipe(
        map(frame => frame)
    );

