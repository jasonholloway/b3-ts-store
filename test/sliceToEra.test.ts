import { Observable, Subject, from, OperatorFunction, pipe } from "rxjs";
import { Dict, scanToArray, enumerate, reduceToArray, tup, reduceToDict } from "../lib/utils";
import { map, concatMap } from "rxjs/operators";
import { EraRef, SliceRef, sliceToEra, Era, Slice } from "../lib/sliceToEra";

type Dict$<V> = Observable<[string, V]>
type Ripple<U> = Dict$<Observable<U>>

//***
//all slices must be complete before a new one is admitted...
//but how can we ensure this?
//
//otherwise it'd be possible to add to a slice from a previous era
//but maybe this is in fact ok
//what we can't have is *committing* an uncompleted slice
//even resetting such a slice would be fine: the publisher to the slice will be emitting into space
//
//as long as all slices up to the point of committing are complete, all is ok
//******


describe('sliceToEra', () => {

    let ripples: Subject<Ripple<number>>
    let thresholds: Subject<number>
    let gathering: Promise<[EraRef, [SliceRef, Dict<number[]>][]][]>

    beforeEach(() => {
        thresholds = new Subject<number>();
        ripples = new Subject<Ripple<number>>();
        gathering = sliceToEra(ripples, thresholds)
                    .pipe(materializeEras())
                    .toPromise();
    })

    it('single slice appears in output', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        
        await expectEras([
            [0, [
                [0, { log1: [ 1, 2, 3 ] }]
            ]]
        ])                
    })

    it('multiple slices appears in output', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });

        await expectEras([
            [0, [
                [0, { log1: [ 1, 2, 3 ] }],
                [1, { log2: [ 4, 5, 6 ] }]
            ]]
        ])                
    })

    it('on threshold move, starts new era', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        threshold(0);

        await expectEras([
            [0, [
                [0, { log1: [ 1, 2, 3 ] }]
            ]],
            [1, []]
        ])
    })


    it('new slices into new era', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        threshold(0);
        ripple({ log1: [ 4 ] });
        
        await expectEras([
            [0, [
                [0, { log1: [ 1, 2, 3 ] }]
            ]],
            [1, [
                [1, { log1: [ 4 ] }]
            ]]
        ])
    })

    it('obsolete slices disappear in new era', async () => {
        ripple({ log1: [ 1 ] });
        ripple({ log1: [ 2 ] });
        ripple({ log1: [ 3 ] })
        threshold(1);
        
        await expectEras([
            [0, [
                [0, { log1: [ 1 ] }],
                [1, { log1: [ 2 ] }],
                [2, { log1: [ 3 ] }]
            ]],
            [1, [
                [2, { log1: [ 3 ] }]
            ]]
        ])
    })



    async function expectEras(expected: [EraRef, [SliceRef, Dict<number[]>][]][]) {
        const r = await complete();
        expect(r).toEqual(expected);
    }


    function complete() {
        thresholds.complete();
        ripples.complete();
        return gathering;
    }

    function threshold(n: number) {
        thresholds.next(n);
    }
    
    function ripple(sl: Dict<number[]>) {
        ripples.next(
            from(enumerate(sl))
                .pipe(map(([k, r]) => tup(k, from(r))))
        );
    }

    function materializeEras() : OperatorFunction<Era<Ripple<number>>, any> {
        return pipe(
            concatMap(([era, slices]) => slices.pipe(
                concatMap(([ref, parts]) => parts.pipe(
                    concatMap(([logRef, updates]) => updates.pipe(                                                                                                                            
                                                        reduceToArray(),
                                                        map(r => tup(logRef, r)))),
                    reduceToDict(),
                    map(u => tup(ref, u)))),
                reduceToArray(),
                map(r => tup(era, r)))),
            scanToArray());
    }


})