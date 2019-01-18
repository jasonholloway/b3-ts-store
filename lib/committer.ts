import { Keyed$ } from "./utils";
import { Evaluable, Model } from "./evaluate";
import { Observable, OperatorFunction, Observer } from "rxjs";
import { share, withLatestFrom, concatMap, take, map, mapTo } from "rxjs/operators";
import { EraWithSlices } from "./slicer";

export type DoCommit = {}

export type DoStore<U> = {
    data: Keyed$<U>
    extent: number
}

export function committer<M extends Model>
    (doCommit$: Observable<DoCommit>, command$: Observer<void>) : OperatorFunction<EraWithSlices<Evaluable<M>>, DoStore<any>> {
    return era$ => {
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
            .subscribe(command$);

        return doStore$;
    }
}
