import { Model, KnownLogs, KnownAggr, Evaluable } from "./evaluateSlices";
import { Observable } from "rxjs";
import { shareReplay, concatMap, debounceTime, startWith } from "rxjs/operators";
import { EraWithSlices } from "./slicer";
import { log } from "./utils";


export const createViewer =
    <M extends Model>
    (era$: Observable<EraWithSlices<Evaluable<M>>>) : Viewer<M> => {
        era$ = era$.pipe(shareReplay(1));
        era$.subscribe();

        return (ref: KnownLogs<M>) =>
            era$.pipe(
                concatMap(({ slices, blocks }) =>       //a-ha... there are no slices at the beginning...
                    slices.pipe(
                        concatMap(([_, {evaluate}]) => evaluate(ref)),
                        // startWith( blocks. )
                        )),
                debounceTime(1) //something of a bodge: ultimately, epoch-number + slice-number + last era command = means of doing this deterministically
                );
    }


//so, the evaluator should be wiring all the evaluables up
//and should be /creating/ an evaluable specially for the blocks
//which the viewer will then default to using if there are no slices about
//
//really, the viewer should firstly create a stream of evaluables, and debounce on this eagerly
//debouncing late still lets of unnecessary work happen: should be nipped in the bud
//
//here: get the latest evaluable (via debouncing),then call 'evaluate()' on it


export type ViewableEra<M extends Model> = EraWithSlices<Evaluable<M>>


export type Viewer<M extends Model> = 
    <K extends KnownLogs<M>>(ref: K) => Observable<KnownAggr<M, K>>




//
//
//