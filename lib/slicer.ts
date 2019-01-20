import { Observable, empty, OperatorFunction, zip, pipe, of, MonoTypeOperatorFunction } from "rxjs";
import { scan, concat, filter, shareReplay, window, map, skip, tap, concatMap, flatMap, concatAll } from "rxjs/operators";
import { tup, reduceToArray } from "./utils";
import { EraWithSpec } from "./specifier";


export interface Tuple2<A, B> extends Array<A | B> {
    0: A,
    1: B,
    length: 2
}

export interface Part<V> extends Tuple2<string, Observable<V>> {}
export interface Part$<V> extends Observable<Part<V>> {}
export interface Ripple<U> extends Part$<U> {}

export interface Range extends Tuple2<number, number> {}
export interface Slice<V> extends Tuple2<Range, V> {}

export type Slice$<V> = Observable<Slice<V>>
export type EraSpec = number;

export interface Era {
    id: number
}

export interface EraWithSlices<V> extends Era {
    slices: Slice$<V>
}


export function slicer<
    U, I extends EraWithSpec, O extends EraWithSlices<Ripple<U>> & I>
    (ripple$: Observable<Ripple<U>>): OperatorFunction<I, O> 
{
    return era$ => {
        era$ = era$.pipe(shareReplay(16));

        const window$ = ripple$.pipe( 
                            pullIntoSlices(),
                            window(era$),         
                            skip(1));

        return zip(era$, window$)
                .pipe(
                    //simple era with latest slices
                    map(([era, slices]) => ({ ...era as EraWithSpec, slices })),

                    //merge in previous eras slices
                    scan(   
                        (prev$: Observable<O>, era: EraWithSlices<Ripple<U>> & EraWithSpec) => {
                            const slices = 
                                prev$.pipe(
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


function pullIntoSlices<U>() : OperatorFunction<Ripple<U>, Slice<Ripple<U>>> {
    return pipe(
        map((part$, i) =>
            slice([i, i + 1], pull(part$)))
    );
}


function pull<U>(part$: Part$<U>): Part$<U> {
    return part$.pipe(
        map(([k, u$]) => tup(k, u$.pipe(pullAll()))),
        pullAll()
    );
}


export function slice<V>([from, to]: Range, v: V): Slice<V> {
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
    (fn: (a: Observable<Ac>, v: V, era: I) => Observable<Ac>, zero: Observable<Ac> = empty()): OperatorFunction<I, O> {
    return pipe(
        map(era => {
            const zeroWrapped = zero.pipe(map(z => slice([0, 0], z)));

            const slices = era.slices.pipe(
                            scan(
                                (prev$: Observable<Slice<Ac>>, [range, v]: Slice<V>) => 
                                    fn(prev$.pipe(map(([_, prev]) => prev)), v, era)
                                        .pipe(
                                            map(result => tup(range, result))
                                        ),                                                 
                                zeroWrapped),
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

export function pullAll<I>(replay = true) : MonoTypeOperatorFunction<I> {
    return era$ => {
        const x = replay ? era$.pipe(shareReplay()) : era$;
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


