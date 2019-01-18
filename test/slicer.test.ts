import { Observable, Subject, from, OperatorFunction, pipe } from "rxjs";
import { Dict, scanToArray, enumerate, reduceToArray, tup, reduceToDict } from "../lib/utils";
import { map, concatMap, startWith } from "rxjs/operators";
import { Range, slicer, EraWithThresh, EraWithSlices } from "../lib/slicer";

type Dict$<V> = Observable<[string, V]>
type Ripple<U> = Dict$<Observable<U>>

jest.setTimeout(500);

describe('slicer', () => {

    let ripples: Subject<Ripple<number>>
    let eras: Subject<EraWithThresh>
    let gathering: Promise<[Range, Dict<number[]>][]>

    beforeEach(() => {
        eras = new Subject<EraWithThresh>();
        ripples = new Subject<Ripple<number>>();

        gathering = eras.pipe(
                        startWith({ thresh: 0 }),
                        slicer(ripples),
                        materializeEras()
                    ).toPromise();
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
        ripples.complete();
        eras.complete();
        return gathering;
    }

    function threshold(n: number) {
        eras.next({ thresh: n });
    }
    
    function ripple(sl: Dict<number[]>) {
        ripples.next(
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