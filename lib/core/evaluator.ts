import { pipe, OperatorFunction } from "rxjs";
import { EraWithSlices, Ripple } from "./slicer";
import { scan, mapTo } from "rxjs/operators";
import { Evaluable, Model } from "./evaluateSlices";


export interface EvaluableEra<M extends Model> 
    extends EraWithSlices<Ripple>, Evaluable<M> { }


export const evaluator = 
    <M extends Model>(model: M) : OperatorFunction<EraWithSlices<Ripple>, EvaluableEra<M>> => 
        pipe(
            scan((ac, era) => null),
            mapTo(null)
        );

