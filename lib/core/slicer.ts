import { Observable, empty, OperatorFunction, zip, pipe, of, MonoTypeOperatorFunction } from "rxjs";
import { scan, concat, filter, shareReplay, window, map, skip, concatMap, flatMap, concatAll, share } from "rxjs/operators";
import { tup, reduceToArray } from "../utils";
import { Manifest } from "./specifier";
import { Evaluable } from "./evaluateSlices";


export interface Tuple2<A, B> extends Array<A | B> {
    0: A,
    1: B,
    length: 2
}

export interface Part<V> extends Tuple2<string, Observable<V>> {}
export interface Part$<V> extends Observable<Part<V>> {}
export interface Ripple<U = any> extends Part$<U> {}

export interface Range extends Tuple2<number, number> {}
export interface Slice<V> extends Tuple2<Range, V> {}

export type Slice$<V> = Observable<Slice<V>>
export type EraSpec = number;

export interface Era {
    id: number,
    manifest: Manifest,
    blocks: Evaluable<any>,
    thresh: number
}

export interface EraWithSlices<V> extends Era {
    slices: Slice$<V>
}


export const slicer =
    (ripple$: Observable<Ripple>): OperatorFunction<Era, EraWithSlices<Ripple>> =>
        era$ => {
            era$ = era$.pipe(shareReplay(16));

            const window$ = ripple$.pipe( 
                                pullIntoSlices(),

                                //slices are numbered here
                                //and the next era's spec must be determined by them
                                //so either we get this information upstream somehow, 
                                //or we fold it in here <-- the right approach

                                window(era$),         
                                skip(1));

            return zip(era$, window$)
                    .pipe(
                        //simple era with latest slices
                        map(([era, slices]) => ({ ...era, slices })),

                        //merge in previous eras slices
                        scan(   
                            (prev$: Observable<EraWithSlices<Ripple>>, era: EraWithSlices<Ripple>) => {
                                const slices = 
                                    prev$.pipe(
                                        flatMap(prev => prev.slices),
                                        concat(era.slices),
                                        filter(([[from], _]) => from >= era.thresh),                    
                                        shareReplay()
                                    );

                                slices.subscribe();

                                return of({ ...era, slices });
                            },
                            empty()),
                        concatAll()
                    );
        };


function pullIntoSlices() : OperatorFunction<Ripple, Slice<Ripple>> {
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


export function scanSlices
    <V, Ac>
    (fn: (a: Ac, v: V) => Ac, zero: Ac): OperatorFunction<EraWithSlices<V>, EraWithSlices<Ac>> {
    return pipe(
        map(era => {
            const slices = era.slices.pipe(
                            scan<Slice<V>, Slice<Ac>>(
                                ([_, ac], [range, v]) => tup(range, fn(ac, v)), 
                                tup(null, zero))
                            );

            return { ...era, slices };
        })
    );
}

export const scanUnwrapSlices =
    <V, Ac>
    (fn: (a: Observable<Ac>, v: V, era: EraWithSlices<V>) => Observable<Ac>, zero: Observable<Ac> = empty()): OperatorFunction<EraWithSlices<V>, EraWithSlices<Ac>> =>
        pipe(
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

                return { ...era, slices };
            })
        );



export function mapSlices
    <A, B>(fn: (a: A) => B): OperatorFunction<EraWithSlices<A>, EraWithSlices<B>> {
    return scanSlices<A, B>((_, v) => fn(v), null);
}


export function concatMapSlices
    <A, B>(fn: (a: A) => Observable<B>) : OperatorFunction<EraWithSlices<A>, EraWithSlices<B>>
{
    return pipe(
            map(era => {
                const slices = era.slices.pipe(
                                concatMap(([range, v]) => fn(v).pipe(
                                                            map(b => tup(range, b))))
                                )

                return { ...era, slices };
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
        const x = era$.pipe(replay ? shareReplay() : share());
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


