import { Keyed$ } from "./utils";
import { Evaluable, Model } from "./evaluate";
import { Observable, OperatorFunction, Observer } from "rxjs";
import { share, withLatestFrom, concatMap, take, map, mapTo, tap } from "rxjs/operators";
import { EraWithSlices } from "./slicer";
import { Signal } from "./specifier";

export type DoCommit = {}

export type DoStore<U> = {
    data: Keyed$<U>
    extent: number
}

export const committer =
    <M extends Model, I extends EraWithSlices<Evaluable<M>>>
    (_: M, doCommit$: Observable<DoCommit>, signal$: Observer<Signal>) : OperatorFunction<I, DoStore<any>> =>
        era$ => {
            doCommit$ = doCommit$.pipe(share());

            const doStore$ = doCommit$.pipe(
                                withLatestFrom(era$),
                                concatMap(([_, {slices}]) => 
                                    slices.pipe(
                                        take(1),
                                        map(([[_, to], {data}]) => ({ extent: to, data })))),
                                share());

            doStore$
                .pipe(mapTo(null))
                .subscribe(signal$);

            return doStore$;
        };
