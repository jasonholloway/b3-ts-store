import { Observable, empty, OperatorFunction, zip } from "rxjs";
import { share, scan, concat, filter, shareReplay, window, map } from "rxjs/operators";
import { tup } from "./utils";

export type Range = [number, number];
export type Slice<V> = [Range, V]
export type Era<V> = Observable<Slice<V>>

export type EraSpec = number;

export function slice<V>(vals: Observable<V>): OperatorFunction<EraSpec, Era<V>> {
    return eras => {
        eras = eras.pipe(share());

        const eraSlices = vals.pipe( 
                            map((v, i) => tup(tup(i, i + 1), v)),
                            window(eras));

        return zip(eras, eraSlices)
                .pipe(
                    scan<[EraSpec, Observable<Slice<V>>], Era<V>>(
                        (prev, [threshold, curr]) => 
                            prev.pipe(
                                concat(curr),
                                filter(([[from, to], _]) => from >= threshold),
                                shareReplay()
                            ),
                        empty()));
    };
}
