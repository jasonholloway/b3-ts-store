import { Observable, empty } from "rxjs";
import { share, withLatestFrom, startWith, scan, concat, filter, shareReplay, window } from "rxjs/operators";
import { addIndex } from "./utils";

export type SliceRef = number;
export type Slice<V> = [SliceRef, V]
export type Slice$<V> = Observable<Slice<V>>

export type EraRef = number
export type Era<V> = [EraRef, Slice$<V>]

export function manageSlices<V>(slices: Observable<V>, thresholds: Observable<number>): Observable<Era<V>> {

    thresholds = thresholds.pipe(share());

    return slices.pipe(addIndex())
            .pipe(
                window(thresholds),

                withLatestFrom(thresholds.pipe(startWith(-1))),

                scan<[Slice$<V>, number], Slice$<V>>(
                    (prev, [curr, threshold]) => 
                        prev.pipe(
                            concat(curr),
                            filter(([id, _]) => id > threshold),
                            shareReplay()
                        ),
                    empty()),

                addIndex()
            );
}
