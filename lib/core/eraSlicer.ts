import { Observable, empty, OperatorFunction, pipe, of, MonoTypeOperatorFunction, concat, forkJoin } from "rxjs";
import { scan, filter, shareReplay, map, concatMap, concatAll, share, defaultIfEmpty, max, startWith, merge } from "rxjs/operators";
import { tup, reduceToArray, logVal, log } from "../utils";
import { Manifest, emptyManifest, Signal, Start } from "./signals";
import { Evaluable, emptyEvaluable } from "./evaluable";
import { Windower, createWindower } from "./windower";
import { newEpoch } from ".";


export interface Tuple2<A, B> extends Array<A | B> {
    0: A,
    1: B,
    length: 2
}

export interface Part<V> extends Tuple2<string, Observable<V>> {}
export interface Part$<V> extends Observable<Part<V>> {}
export interface Ripple<U = any> extends Part$<U> {}

export type SliceId = number
export interface Slice<V = any> extends Tuple2<SliceId, Ripple<V>> {}

export type Slice$<V> = Observable<Slice<V>>

export interface Era<V = any> {
    id: number,
    manifest: Manifest,
    blocks: Evaluable<any>,
    thresh: number
    from: number,
    oldSlice$: Slice$<V>,
    currSlice$: Slice$<V>,
    slices: Slice$<V>,
}

interface Spec {
    from$: Observable<number>,
    thresh$: Observable<number>
}


const emptyEra: Era = {
    id: -1,
    thresh: 0,
    from: 0,
    oldSlice$: empty(),
    currSlice$: empty(),
    slices: empty(),
    manifest: emptyManifest,
    blocks: emptyEvaluable,
}

export type Epoch = [Manifest, Evaluable]

export function eraSlicer(signal$: Observable<Signal>, ripple$: Observable<Ripple>) : OperatorFunction<Epoch, Era> {
    const getWindow = createWindower(ripple$);
    return pipe(
        map(([manifest, blocks]) => 
            newEpoch(manifest, blocks)),
        merge(signal$),
        scan((prev$: Observable<Era>, signal: Signal) => {
            return prev$.pipe(
                digestPrevious(),
                handle(signal),
                setEraId(),
                sliceRipples(getWindow),
                shareReplay(1)
            ) },
            of(emptyEra)),

        concatAll()
    );
}


function digestPrevious() : OperatorFunction<Era, [Era, Spec, Era]> {
    return map((prev: Era) => {
        const from$ = prev.slices.pipe(
                                map(([sliceId]) => sliceId),
                                max(),
                                map(i => i + 1),
                                defaultIfEmpty(prev.from),
                                shareReplay(1));

        const spec = {
            from$,
            thresh$: of(prev.thresh)
        };

        return tup(prev, spec, { ...prev });
    })
}


function handle(signal: Signal): MonoTypeOperatorFunction<[Era, Spec, Era]> {
    return map(([prev, spec, era]) => {
        switch(signal[0]) {
            case 'Start':
            case 'RefreshEra': {
                return tup(prev, spec, era);
            }
            case 'DoReset': {
                return tup(prev, { ...spec, thresh$: spec.from$ }, era);
            }
            case 'Epoch': {
                const [manifest, blocks] = signal[1];
                return tup(prev, spec, { ...era, manifest, blocks });
            }
            case 'NewManifest': {
                const manifest = signal[1];
                return tup(prev, spec, { ...era, manifest });
            }
            case 'SetThreshold': {
                const thresh = signal[1];
                return tup(prev, { ...spec, thresh$: of(thresh) }, era);
            }
            default:
                throw `Strange Signal: ${signal[0]}`;
        }
    });
}


function setEraId() : MonoTypeOperatorFunction<[Era, Spec, Era]> {
    return map(([prev, spec, era]) => 
                tup(prev, spec, { ...era, id: era.id + 1 }));
}


function sliceRipples(getWindow: Windower<Ripple>) : OperatorFunction<[Era, Spec, Era], Era> {
    return concatMap(([prev, spec, era]) => {
        const ripple$ = getWindow()
                        .pipe(pullAll());
            
        return forkJoin(spec.from$, spec.thresh$).pipe(
                map(([from, thresh]) => {
                    const oldSlice$ = prev.slices.pipe(
                                        filter(([sliceId]) => sliceId >= thresh),
                                        shareReplay());
    
                    const currSlice$ = ripple$.pipe(
                                        map((part$, i) => slice(from + i, part$)),
                                        shareReplay());
    
                    const slice$ = concat(oldSlice$, currSlice$);
                    slice$.subscribe();
                        
                    return {
                        ...era,
                        from,
                        thresh,
                        oldSlice$,
                        currSlice$,
                        slices: slice$
                    };
                }))  
    });
}


export function pullRipples() : MonoTypeOperatorFunction<Ripple> {
    return pipe(
        map(part$ => 
            part$.pipe(
                map(([k, v$]) => tup(k, v$.pipe(pullAll()))),
                pullAll()))
    );
}


export function slice<V>(sliceId: SliceId, ripple: Ripple<V>): Slice<V> {
    return tup(sliceId, ripple);
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


export function pullAllSlices<A, I extends Era<A>>() : MonoTypeOperatorFunction<I> {
    return eras => {
        const x = eras.pipe(
                    map(era => {
                        const slices = era.slices.pipe(shareReplay());
                        slices.subscribe();
                        return { ...era as Era<A>, slices } as I
                    }),
                    shareReplay())

        x.subscribe();

        return x;
    }
}


