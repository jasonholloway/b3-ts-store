import { Evaluable } from "./evaluateSlices";
import { Observable, OperatorFunction, Observer, pipe, empty, MonoTypeOperatorFunction } from "rxjs";
import { share, withLatestFrom, concatMap, take, map, mapTo, reduce } from "rxjs/operators";
import { EraWithSlices, Slice, Era, Ripple } from "./slicer";
import { RefreshEra, newEra } from "./specifier";
import { reduceToDict, reduceToArray, tup, Dict } from "../utils";

export type DoCommit = {}

export interface Commit {
    era: Era
    data: Dict<any[]>
    extent: number,
    errors: Observable<Error>
}

export const committer =
    (era$: Observable<EraWithSlices<[Ripple<any>, Evaluable]>>, refreshEra$: Observer<RefreshEra>) : OperatorFunction<DoCommit, Commit> =>
        doCommit$ => {
            const c$ = doCommit$.pipe(
                        withLatestFrom(era$),
                        share());

            c$.pipe(mapTo(newEra()))
                .subscribe(refreshEra$);
            
            return c$.pipe(
                    concatMap(([_, era]) => 
                        era.slices.pipe(
                            //take(1),
                            reduceIntoOne(),
                            materialize(era))),
                    share());
        };

//the above is creating multiple commits...
//
//we want to bungle them all into one...
//but we also want to (eventually) actually evaluate what we're committing
//so the /final/ slice found should be evaluated, but using the logRefs of /all/ slices
//this is for the near future however

//for now we just want to bung everything into one single commit
//
//


function reduceIntoOne() : MonoTypeOperatorFunction<Slice<[Ripple<any>, Evaluable]>> {
    return pipe(
        reduce((ac, [ripple, evaluable]) => {
            throw 12345;
        })
    );
    

    //
    //
    //
}



function materialize(era: Era) : OperatorFunction<Slice<[Ripple<any>, Evaluable]>, Commit> {
    return pipe(
        concatMap(([_, [data, evaluable]]) =>
            data.pipe(
                concatMap(([k, u$]) => 
                    u$.pipe(
                        reduceToArray(),
                        map(r => tup(k, r)))),             
                reduceToDict(),
                map(data => ({ data, extent: 1, era, errors: empty() }))
            ))
        );
}
