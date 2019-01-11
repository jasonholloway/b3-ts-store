import { Observable, empty, OperatorFunction, zip } from "rxjs";
import { share, scan, concat, filter, shareReplay, window } from "rxjs/operators";
import { addIndex } from "./utils";

export type SliceRef = number;
export type Slice<V> = [SliceRef, V]
export type Era<V> = Observable<Slice<V>>

export type EraSpec = number;

export function slice<V>(vals: Observable<V>): OperatorFunction<EraSpec, Era<V>> {

    return eras => {
        eras = eras.pipe(share());

        const eraSlices = vals.pipe(addIndex(), window(eras));

        return zip(eras, eraSlices)
                .pipe(
                    scan<[EraSpec, Observable<[number, V]>], Era<V>>(
                        (prev, [threshold, curr]) => 
                            prev.pipe(
                                concat(curr),
                                filter(([sliceId, _]) => sliceId >= threshold),
                                shareReplay()
                            ),
                        empty()));
    };
}
