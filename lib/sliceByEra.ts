import { Observable, empty, OperatorFunction, zip } from "rxjs";
import { scan, concat, filter, shareReplay, window, map, skip, tap } from "rxjs/operators";
import { tup } from "./utils";

export type Range = [number, number];
export type Slice<V> = [Range, V]
export type Era<V> = [EraSpec, Observable<Slice<V>>]
export type EraSpec = number;

export function sliceByEra<V>(vals: Observable<V>): OperatorFunction<EraSpec, Era<V>> {
    return eras => {
        eras = eras.pipe(shareReplay(16));

        const windows = vals.pipe( 
                            map((v, i) => slice([i, i + 1], v)),
                            window(eras),                            
                            skip(1));

        return zip(eras, windows)
                .pipe(
                    scan<Era<V>>(   
                        ([_, prev], [threshold, curr]) => {
                            const slices = prev.pipe(
                                            concat(curr),
                                            filter(([[from, to], _]) => from >= threshold),                                
                                            shareReplay());
                             
                            slices.subscribe();

                            return tup(threshold, slices);
                        },
                        tup(null, empty())));
    };
}

export function slice<V>([from, to]: [number, number], v: V): Slice<V> {
    return tup(tup(from, to), v);
}


