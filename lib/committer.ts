import { Evaluable, Model } from "./evaluate";
import { Observable, OperatorFunction, Observer, pipe, Subject, ReplaySubject, empty } from "rxjs";
import { share, withLatestFrom, concatMap, take, map } from "rxjs/operators";
import { EraWithSlices, Ripple } from "./slicer";
import { RefreshEra, EraWithSpec } from "./specifier";

export type DoCommit = {}

export interface Commit {
    era: EraWithSpec
    data: Ripple<any>
    extent: number,
    errors: Observable<Error>
}


export const committer =
    <M extends Model, E extends EraWithSpec & EraWithSlices<Evaluable<M>>>
    (_: M, era$: Observable<E>, refreshEra$: Observer<RefreshEra>) : OperatorFunction<DoCommit, Commit> =>
        pipe(
            withLatestFrom(era$),
            concatMap(([_, era]) => 
                era.slices.pipe(
                    take(1),
                    map(([[_, to], {data}]) => ({ 
                        extent: to, 
                        data, 
                        era,
                        errors: empty()
                    })))),
            share());

        // doStore$
        //     .pipe(mapTo(newEra()))
        //     .subscribe(refreshEra$);
        //ABOVE NEEDS REINSTATING! ***************************
        //but it'd be good to show its absence with a test...

//it'd also be nice if the committer did the materialiation...
//the Pusher is doing to much:it's concern should be the protocol with the stores
//though - materialization is a dirty thing;
//if the stores themselves were nicer...
