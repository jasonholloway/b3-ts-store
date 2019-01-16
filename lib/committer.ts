import { Keyed$ } from "./utils";
import { Era$, Evaluable, Model } from "./evaluate";
import { Observable } from "rxjs";
import { share, withLatestFrom, concatMap, take, map } from "rxjs/operators";

export type DoCommit = {}

export type DoStore<U> = {
    data: Keyed$<U>
    extent: number
}

export function committer<M extends Model>(era$: Era$<Evaluable<M>>, doCommit$: Observable<DoCommit>) {
    doCommit$ = doCommit$.pipe(share());

    const doStore$ = doCommit$.pipe(
                        withLatestFrom(era$),
                        concatMap(([_, [__, slices]]) => 
                            slices.pipe(
                                take(1),
                                map(([[_, to], {data}]) => ({ extent: to, data })))),
                        share());
    return {
        doStore$,
        newEra$: doStore$.pipe(map(() => {}))
    }
}
