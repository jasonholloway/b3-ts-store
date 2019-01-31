import { Observable, empty, OperatorFunction, zip, pipe, of, MonoTypeOperatorFunction, concat } from "rxjs";
import { scan, filter, shareReplay, window, map, skip, concatMap, flatMap, concatAll, share, last, defaultIfEmpty, withLatestFrom, max, tap } from "rxjs/operators";
import { tup, reduceToArray, logVal } from "../utils";
import { Manifest, emptyManifest } from "./specifier";
import { Evaluable } from "./evaluable";


export interface Tuple2<A, B> extends Array<A | B> {
    0: A,
    1: B,
    length: 2
}

export interface Part<V> extends Tuple2<string, Observable<V>> {}
export interface Part$<V> extends Observable<Part<V>> {}
export interface Ripple<U = any> extends Part$<U> {}

export type SliceId = number
export interface Slice<V = Ripple> extends Tuple2<SliceId, V> {}

export type Slice$<V> = Observable<Slice<V>>
export type EraSpec = number;

export interface Era {
    id: number,
    manifest: Manifest,
    blocks: Evaluable<any>,
    thresh: number
}

export interface EraWithSlices<V = any> extends Era {
    from: number,
    oldSlice$: Slice$<V>,
    currSlice$: Slice$<V>,
    slices: Slice$<V>,
}

const emptyEra: EraWithSlices<Ripple> = {
    id: 0,
    thresh: 0,
    from: 0,
    oldSlice$: empty(),
    currSlice$: empty(),
    slices: empty(),
    manifest: emptyManifest,
    blocks: null,
}

export const slicer =
    (ripple$: Observable<Ripple>): OperatorFunction<Era, EraWithSlices<Ripple>> =>
        era$ => {
            era$ = era$.pipe(shareReplay(16));

            const window$ = ripple$.pipe( 
                                pullRipples(),
                                window(era$),     
                                skip(1));

            return zip(era$, window$)
                    .pipe(
                        scan(   
                            (prevEra$: Observable<EraWithSlices<Ripple>>, [era, ripple$]: [Era, Observable<Ripple>]) => {

                                //*************************************
                                //from should default to thresh!
                                //need to expose faultiness via test 1st
                                //**************************************

                                const from$ = prevEra$.pipe(
                                                concatMap(prev => 
                                                    prev.slices.pipe(
                                                        map(([sliceId]) => sliceId + 1),
                                                        defaultIfEmpty(prev.from),
                                                        max())),
                                                defaultIfEmpty(0),
                                                shareReplay(1));

                                const oldSlice$ = prevEra$.pipe(
                                                    concatMap(prev => prev.slices),
                                                    filter(([sliceId]) => sliceId >= era.thresh),
                                                    shareReplay());

                                const currSlice$ = ripple$.pipe(
                                                    withLatestFrom(from$),
                                                    map(([part$, start], i) => slice(start + i, part$)),
                                                    shareReplay());

                                const slice$ = concat(oldSlice$, currSlice$);
                                slice$.subscribe();

                                return from$.pipe(
                                    map(from => ({
                                        ...era,
                                        from,
                                        oldSlice$,
                                        currSlice$,
                                        slices: slice$
                                    })));
                            },
                            empty()),
                        concatAll()
                    );
        };


export function pullRipples() : MonoTypeOperatorFunction<Ripple> {
    return pipe(
        map(part$ => 
            part$.pipe(
                map(([k, v$]) => tup(k, v$.pipe(pullAll()))),
                pullAll()))
    );
}


export function slice<V>(sliceId: SliceId, v: V): Slice<V> {
    return tup(sliceId, v);
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


