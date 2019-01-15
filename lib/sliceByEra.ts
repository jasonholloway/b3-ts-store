import { Observable, empty, OperatorFunction, zip, GroupedObservable, pipe } from "rxjs";
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



export function scanSlices<V, Ac>(fn: (a: Ac, v: V) => Ac, zero: Ac): OperatorFunction<Era<V>, Era<Ac>> {
    return pipe(
        map(([spec, slices]) => tup(spec, 
            slices.pipe(
                scan<Slice<V>, Slice<Ac>>(
                    ([_, ac], [range, v]) => tup(range, fn(ac, v)), 
                    tup(null, zero)),
            )))
    );
}

export function mapSlices<A, B>(fn: (a: A) => B): OperatorFunction<Era<A>, Era<B>> {
    return scanSlices((_, v) => fn(v), null);
}


