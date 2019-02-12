import { Observable, empty, OperatorFunction, pipe, of, MonoTypeOperatorFunction, concat, forkJoin } from "rxjs";
import { filter, shareReplay, map, concatMap, share, defaultIfEmpty, merge, takeLast, toArray } from "rxjs/operators";
import { tup, concatScan } from "../utils";
import { Manifest, emptyManifest, Signal, NewEpoch } from "./signals";
import { Evaluable, emptyEvaluable } from "./evaluable";
import { Windower, createWindower } from "./windower";
import { Commit } from "./committer";


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


export const emptyEra: Era = {
    id: -1,
    thresh: 0,
    from: 0,
    oldSlice$: empty(),
    currSlice$: empty(),
    slices: empty(),
    manifest: emptyManifest,
    blocks: emptyEvaluable,
}


export type Epoch = { manifest: Manifest, commit?: Commit }


//reset sends a signal into scan
//but then completion occurs
//
//which biffs the prev$ that would otherwise be piped from
//signal$ needs to complete before era$
//

export const newEpoch = (epoch: Epoch, blocks: Evaluable): NewEpoch => 
    ['Epoch', tup(epoch, blocks)];


export function eraSlicer(signal$: Observable<Signal>, ripple$: Observable<Ripple>) : OperatorFunction<Epoch & Evaluable, Era> {
    const getWindow = createWindower(ripple$);
    return pipe(
        map(e => newEpoch(e, e)),
        merge(signal$),
        concatScan(
            (prev: Era, signal: Signal) =>
                of(prev).pipe(
                    digestPrevious(),
                    handleSignals(signal),
                    setEraId(),
                    sliceRipples(getWindow),
                    shareReplay(1)
                ), emptyEra));
}


function digestPrevious() : OperatorFunction<Era, [Era, Spec, Era]> {
    return map((prev: Era) => {
        const from$ = prev.currSlice$.pipe(
                        takeLast(1),
                        map(([i]) => i + 1),
                        defaultIfEmpty(prev.from),
                        shareReplay(1));

        const spec = {
            from$,
            thresh$: of(prev.thresh)
        };

        return tup(prev, spec, { ...prev });
    })
}


function handleSignals(signal: Signal): MonoTypeOperatorFunction<[Era, Spec, Era]> {
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
                const [epoch, blocks] = signal[1];
                return tup(
                    {   ...prev }, 
                    {   ...spec, 
                        thresh$: epoch.commit 
                                ? of(epoch.commit.range[0] + epoch.commit.range[1])
                                : of(prev.thresh)   },
                    {   ...era,
                        manifest: epoch.manifest,
                        blocks  });
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
            slices.pipe(toArray())),
        toArray()
        );
}

export function pullReplay<V>(n: number = undefined) : MonoTypeOperatorFunction<V> {
    return era$ => {
        const x = era$.pipe(shareReplay(n));
        x.subscribe();
        return x;
    };
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


