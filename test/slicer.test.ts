import { Observable, Subject, from, OperatorFunction, pipe, zip, merge } from "rxjs";
import { Dict, scanToArray, enumerate, reduceToArray, tup, reduceToDict } from "../lib/utils";
import { map, concatMap } from "rxjs/operators";
import { Range, slicer, EraWithSlices } from "../lib/core/slicer";
import { emptyManifest, Signal, specifier, Manifest, setThreshold } from "../lib/core/specifier";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { newEpoch } from "../lib/core/createCore";
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
    let gathering: Promise<[Range, Dict<number[]>][]>

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

        gathering = merge(epoch$, signal$).pipe(
                        specifier(),
                        slicer(ripple$),
                        materializeEras()
                    ).toPromise();

        manifest$.next(emptyManifest);
    })

    it('single slice appears in output', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        
        await expectEras([
            [
                [[0, 1], { log1: [ 1, 2, 3 ] }]
            ]
        ])                
    })

    it('multiple slices appears in output', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });

        await expectEras([
            [
                [[0, 1], { log1: [ 1, 2, 3 ] }],
                [[1, 2], { log2: [ 4, 5, 6 ] }]
            ]
        ])                
    })

    it('on threshold move, starts new era', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        threshold(1);

        await expectEras([
            [
                [[0, 1], { log1: [ 1, 2, 3 ] }]
            ],
            []
        ])
    })


    it('new slices into new era', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        threshold(1);
        ripple({ log1: [ 4 ] });
        
        await expectEras([
            [
                [[0, 1], { log1: [ 1, 2, 3 ] }]
            ],
            [
                [[1, 2], { log1: [ 4 ] }]
            ]
        ])
    })

    it('obsolete slices disappear in new era', async () => {
        ripple({ log1: [ 1 ] });
        ripple({ log1: [ 2 ] });
        ripple({ log1: [ 3 ] })
        threshold(2);
        
        await expectEras([
            [
                [[0, 1], { log1: [ 1 ] }],
                [[1, 2], { log1: [ 2 ] }],
                [[2, 3], { log1: [ 3 ] }]
            ],
            [
                [[2, 3], { log1: [ 3 ] }]
            ]
        ])
    })


    it('output slices can be combined', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });

        await expectEras([
            [
                [[0, 1], { log1: [ 1, 2, 3 ] }],
                [[1, 2], { log2: [ 4, 5, 6 ] }]
            ]
        ])
    })





    async function expectEras(expected: [Range, Dict<number[]>][][]) {
        const r = await complete();
        expect(r).toEqual(expected);
    }


    function complete() {
        ripple$.complete();
        signal$.complete();
        return gathering;
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