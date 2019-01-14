import { OperatorFunction, pipe, Subject, from, Observable } from "rxjs";
import { Era, Slice, slice, EraSpec } from "../lib/sliceByEra";
import { tap, map, concatMap, scan } from "rxjs/operators";
import { tup, reduceToArray, scanToArray } from "../lib/utils";


type Aggregator<V, A> = (aggr: A, val: V) => A;

//*************************************************
//but also want to stream in base aggrs from blocks...
//*************************************************


function viewSlices<V, A>(fnAggr: Aggregator<V, A>, zero: A) : OperatorFunction<Era<V>, Era<[V, A]>> {
    return pipe(
        map(([spec, slices]) =>
            tup(
                spec,
                slices.pipe(
                    scan<Slice<V>, Slice<[V, A]>>(
                        ([_, [__, prev]], [range, v]) => slice(range, tup(v, fnAggr(prev, v))),
                        slice([0, 0], tup(null, zero))))
                ))
    );    
}


type Val = number;
type Aggr = number[];


describe('viewSlices',() => {

    let rawEras: Subject<Era<Val>>;
    let gathering: Promise<Slice<[Val, Aggr]>[][]>

    beforeEach(() => {
        rawEras = new Subject<Era<number>>();
        gathering = rawEras.pipe(
                        viewSlices((ac, v) => [...ac, v], []),
                        materializeEras())
                    .toPromise();
    })

    it('aggregates views cumulatively', async () => {
        rawEra(0, [
            slice([0, 1], 1),
            slice([1, 2], 2),
            slice([2, 3], 3)
        ]);

        await expectEras([
            [
                [[0, 1], [1, [1]]],
                [[1, 2], [2, [1, 2]]],
                [[2, 3], [3, [1, 2, 3]]]
            ]
        ]);
    })

    it('new era with new base, new aggregation', async () => {
        rawEra(0, [
            slice([0, 1], 1),
            slice([1, 2], 2),
            slice([2, 3], 3)
        ]);

        await expectEras([
            [
                [[0, 1], [1, [1]]],
                [[1, 2], [2, [1, 2]]],
                [[2, 3], [3, [1, 2, 3]]]
            ]
        ]);

        //each era has a base aggregation,
        //that is requested lazily per era
        //but this requires an idea of reference resolution

        //as is, the viewer just expects V to be monoidal
        //but really... ZERO ITSELF SHOULD BE A STREAM
        //
        //or, even better... zero itself is taken from the era,
        //and each 
    
    })





    function complete() {
        rawEras.complete();
        return gathering;
    }

    function rawEra(spec: EraSpec, slices: Slice<Val>[]) {
        rawEras.next(tup(spec, from(slices)));
    }

    async function expectEras(expected: Slice<[Val, Aggr]>[][]) {
        const r = await complete();
        expect(r).toEqual(expected);
    }
})



function materializeEras<V>() : OperatorFunction<Era<V>, Slice<V>[][]> {
    return pipe(
        concatMap(([_, slices]) => slices.pipe(
            reduceToArray())),
        scanToArray());
}


