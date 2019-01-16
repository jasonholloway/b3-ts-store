import { Observable, empty, OperatorFunction, zip, GroupedObservable, pipe } from "rxjs";
import { scan, concat, filter, shareReplay, window, map, skip, tap, concatMap } from "rxjs/operators";
import { tup, reduceToArray } from "./utils";


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

export function concatMapSlices<A, B>(fn: (a: A) => Observable<B>) : OperatorFunction<Era<A>, Era<B>> {
    return pipe(
        map(([spec, slices]) => tup(spec, 
            slices.pipe(
                concatMap(([range, v]) => fn(v).pipe(
                                            map(b => tup(range, b))))
                )))
    );

}

    
export function materializeSlices<V>() : OperatorFunction<Era<V>, Slice<V>[][]> {
    return pipe(
        concatMap(([_, slices]) =>
            slices.pipe(
                reduceToArray()
                )),
        reduceToArray()
        );
}

export function pullAllSlices<A>() : OperatorFunction<Era<A>, Era<A>> {
    return eras => {
        eras = eras.pipe(
                map(([spec, slices]) => {
                    slices = slices.pipe(shareReplay());
                    slices.subscribe();
                    return tup(spec, slices);
                }),
                shareReplay())

        eras.subscribe();
        return eras;
    }
}


