import { Observable, empty, OperatorFunction, zip, GroupedObservable, pipe, of, MonoTypeOperatorFunction } from "rxjs";
import { scan, concat, filter, shareReplay, window, map, skip, tap, concatMap, flatMap, concatAll } from "rxjs/operators";
import { tup, reduceToArray } from "./utils";


export type Range = [number, number];

export interface Slice<V> extends Array<Range | V> {
    0: Range
    1: V
    length: 2
}

export type Slice$<V> = Observable<Slice<V>>
export type EraSpec = number;

export interface Era {
    id: number
}

export interface EraWithThresh extends Era {
    thresh: EraSpec
}

export interface EraWithSlices<V> extends Era {
    slices: Slice$<V>
}


export function slicer<
    V, I extends EraWithThresh, O extends EraWithSlices<V> & I>
    (vals: Observable<V>): OperatorFunction<I, O> 
{
    return eras => {
        eras = eras.pipe(shareReplay(16));

        const windows = vals.pipe( 
                            map((v, i) => slice([i, i + 1], v)),
                            window(eras),                            
                            skip(1));

        return zip(eras, windows)                
                .pipe(
                    //simple era with latest slices
                    map(([era, slices]) => ({ ...era as EraWithThresh, slices })),

                    //merge in previous eras slices
                    scan(   
                        (prev$: Observable<O>, era: EraWithSlices<V> & EraWithThresh) => {
                            const slices = prev$.pipe(
                                                flatMap(prev => prev.slices),
                                                concat(era.slices),
                                                filter(([[from, to], _]) => from >= era.thresh),                                
                                                shareReplay()
                                            );

                            slices.subscribe();

                            return of({ ...era as object, slices } as O);
                        },
                        empty()),
                    concatAll()
                );
    };
}


export function slice<V>([from, to]: [number, number], v: V): Slice<V> {
    return tup(tup(from, to), v);
}


export function scanSlices<
    V, Ac, I extends EraWithSlices<V>, O extends EraWithSlices<Ac> & I>
    (fn: (a: Ac, v: V) => Ac, zero: Ac): OperatorFunction<I, O> {
    return pipe(
        map(era => {
            const slices = era.slices.pipe(
                            scan<Slice<V>, Slice<Ac>>(
                                ([_, ac], [range, v]) => tup(range, fn(ac, v)), 
                                tup(null, zero))
                            );

            return { ...era as object, slices } as O;
        })
    );
}

export function scanUnwrapSlices<
    V, Ac, I extends EraWithSlices<V>, O extends EraWithSlices<Ac> & I>
    (fn: (a: Observable<Ac>, v: V) => Observable<Ac>): OperatorFunction<I, O> {
    return pipe(
        map(era => {
            const slices = era.slices.pipe(
                            scan(
                                (prev$: Observable<Slice<Ac>>, [range, v]: Slice<V>) => 
                                    fn(prev$.pipe(map(([_, prev]) => prev)), v)
                                        .pipe(
                                            map(result => tup(range, result))
                                        ),                                                 
                                empty()),
                            concatAll()
                            );

            return { ...era as object, slices } as O;
        })
    );
}



export function mapSlices<
    A, B, I extends EraWithSlices<A>, O extends EraWithSlices<B> & I>
    (fn: (a: A) => B): OperatorFunction<I, O> {
    return scanSlices<A, B, I, O>((_, v) => fn(v), null);
}


export function concatMapSlices<
    A, B, I extends EraWithSlices<A>, O extends EraWithSlices<B> & I>
    (fn: (a: A) => Observable<B>) : OperatorFunction<I, O>
{
    return pipe(
            map(era => {
                const slices = era.slices.pipe(
                                concatMap(([range, v]) => fn(v).pipe(
                                                            map(b => tup(range, b))))
                                )

                return { ...era as object, slices } as O;
            }));   
}

    
export function materializeSlices<V, I extends { slices: Slice$<V> }>() : OperatorFunction<I, Slice<V>[][]> {
    return pipe(
        concatMap(({ slices }) =>
            slices.pipe(
                reduceToArray()
                )),
        reduceToArray()
        );
}

export function pullAll<I>() : MonoTypeOperatorFunction<I> {
    return era$ => {
        const x = era$.pipe(shareReplay());
        x.subscribe();
        return x;
    };
}


export function pullAllSlices<A, I extends EraWithSlices<A>>() : MonoTypeOperatorFunction<I> {
    return eras => {
        const x = eras.pipe(
                    map(era => {
                        const slices = era.slices.pipe(shareReplay());
                        slices.subscribe();
                        return { ...era as EraWithSlices<A>, slices } as I
                    }),
                    shareReplay())

        x.subscribe();

        return x;
    }
}


