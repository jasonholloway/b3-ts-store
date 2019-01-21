import { Evaluable, Model } from "./evaluate";
import { Observable, OperatorFunction, Observer, pipe } from "rxjs";
import { share, withLatestFrom, concatMap, take, map } from "rxjs/operators";
import { EraWithSlices, Ripple, pullAll } from "./slicer";
import { newEra, RefreshEra } from "./specifier";
import { tup, log } from "./utils";

export type DoCommit = {}

export type DoStore<U> = {
    data: Ripple<U>
    extent: number
}

export const committer =
    <M extends Model>
    (era$: Observable<EraWithSlices<Evaluable<M>>>, refreshEra$: Observer<RefreshEra>) : OperatorFunction<DoCommit, DoStore<any>> =>
        pipe(
            withLatestFrom(era$),
            concatMap(([_, {slices}]) => 
                slices.pipe(
                    take(1),
                    map(([[_, to], {data}]) => ({ extent: to, data})))),
            share());

        // doStore$
        //     .pipe(mapTo(newEra()))
        //     .subscribe(refreshEra$);
