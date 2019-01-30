import { Observable, Subject, from, OperatorFunction, pipe, zip, merge } from "rxjs";
import { Dict, scanToArray, enumerate, reduceToArray, tup, reduceToDict } from "../lib/utils";
import { map, concatMap, toArray } from "rxjs/operators";
import { slicer, EraWithSlices, pullAllSlices, SliceId } from "../lib/core/slicer";
import { emptyManifest, Signal, specifier, Manifest, setThreshold } from "../lib/core/specifier";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { newEpoch } from "../lib/core";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { TestModel } from "./fakes/testModel";

type Dict$<V> = Observable<[string, V]>
type Ripple<U> = Dict$<Observable<U>>

jest.setTimeout(500);

describe('slicer', () => {

    let model = new TestModel();

    let blockStore: FakeBlockStore;

    let manifest$: Subject<Manifest>
    let ripple$: Subject<Ripple<number>>
    let signal$: Subject<Signal>

    let era$: Observable<EraWithSlices<Ripple<number>>>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        manifest$ = new Subject<Manifest>();
        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();

        const epoch$ = zip(
                        manifest$,
                        manifest$.pipe(
                            pullBlocks(blockStore),
                            evaluateBlocks(model))
                    ).pipe(map(e => newEpoch(...e)));

        era$ = merge(epoch$, signal$).pipe(
                    specifier(),
                    slicer(ripple$),
                    pullAllSlices());

        manifest$.next(emptyManifest);
    })

    it('single slice appears in output', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        
        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }]
            ]
        ])                
    })

    it('multiple slices appears in output', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });

        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }],
                [1, { log2: [ 4, 5, 6 ] }]
            ]
        ])                
    })

    it('on threshold move, starts new era', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        threshold(1);

        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }]
            ],
            []
        ])
    })


    it('new slices into new era', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        threshold(1);
        ripple({ log1: [ 4 ] });
        
        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }]
            ],
            [
                [1, { log1: [ 4 ] }]
            ]
        ])
    })

    it('obsolete slices disappear in new era', async () => {
        ripple({ log1: [ 1 ] });
        ripple({ log1: [ 2 ] });
        ripple({ log1: [ 3 ] })
        threshold(2);
        
        await expectSlices([
            [
                [0, { log1: [ 1 ] }],
                [1, { log1: [ 2 ] }],
                [2, { log1: [ 3 ] }]
            ],
            [
                [2, { log1: [ 3 ] }]
            ]
        ])
    })


    it('output slices can be combined', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });

        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }],
                [1, { log2: [ 4, 5, 6 ] }]
            ]
        ])
    })


    it('era.from populated on new eras', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });
        threshold(0);
        
        await expectEras([
            { from: 0 },
            { from: 2 }
        ])
    })



    async function expectEras(expected: any[]) {
        complete();
        const eras = await era$.pipe(toArray()).toPromise();
        expect(eras).toMatchObject(expected);
    }



    async function expectSlices(expected: [SliceId, Dict<number[]>][][]) {
        complete();
        const eras = await era$.pipe(materializeEras()).toPromise();
        expect(eras).toMatchObject(expected);
    }

    function complete() {
        ripple$.complete();
        signal$.complete();
    }

    function threshold(n: number) {
        signal$.next(setThreshold(n));
    }
    
    function ripple(sl: Dict<number[]>) {
        ripple$.next(
             from(enumerate(sl))
                 .pipe(map(([k, r]) => tup(k, from(r))))
        );
    }

    function materializeEras() : OperatorFunction<EraWithSlices<Ripple<number>>, any> {
        return pipe(
            concatMap(({ slices }) => slices.pipe(
                concatMap(([sliceId, parts]) => parts.pipe(
                    concatMap(([logRef, updates]) => updates.pipe(                                                                                                                            
                                                        reduceToArray(),
                                                        map(r => tup(logRef, r)))),
                    reduceToDict(),
                    map(u => tup(sliceId, u)))),
                reduceToArray())),
            scanToArray());
    }


})