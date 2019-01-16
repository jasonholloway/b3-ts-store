import { Subject, from, OperatorFunction, pipe } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, reduceToDict } from "../lib/utils";
import { sliceByEra, EraSpec } from "../lib/sliceByEra";
import { map, concatMap, scan, groupBy } from "rxjs/operators";
import { evaluate } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, DoStore } from "../lib/committer";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('committer', () => {

    const model = new TestModel();

    let spec$: Subject<EraSpec>
    let ripple$: Subject<Keyed$<number>>
    let doCommit$: Subject<DoCommit>
    let gathering: Promise<{ data: Dict<number[]>, extent: number }[]>

    beforeEach(() => {
        spec$ = new Subject<EraSpec>();
        ripple$ = new Subject<Keyed$<number>>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = spec$.pipe(
                        sliceByEra(ripple$),
                        evaluate(model));

        const { doStore$, newEra$ } = committer(era$, doCommit$);

        newEra$.pipe(scan<void, number>((ac, _) => ac + 1, 0))
            .subscribe(spec$);

        gathering = doStore$
                    .pipe(materialize())
                    .toPromise();

        spec$.next(0);
    })


    it('stores first slice', async () => {
        ripple({ a: [ 1, 2 ] });
        ripple({ b: [ 1 ] });
        doCommit();

        await expectStores([{
            data: { a: [ 1, 2 ] },
            extent: 1
        }]);
    })

    it('does nothing if no slices', async () => {
        doCommit();

        await expectStores([]);
    })

    xit('only commits if slice known good', async () => {
        ripple({ a: [ 1, 2 ] });
        doCommit();
        await expectStores([]);
    })



    function ripple(rip: TestRipple) {
        const ripple = from(enumerate(rip)).pipe(
                        concatMap(([k, r]) => from(r).pipe(map(v => tup(k, v)))),
                        groupBy(([k]) => k, ([_, v]) => v));
                    
        ripple$.next(ripple);
    }

    function doCommit() {
        doCommit$.next();
    }


    async function expectStores(doStores: { data: Dict<number[]>, extent: number }[]) {
        const r = await complete();
        expect(r).toEqual(doStores);
    }

    function complete() {
        ripple$.complete();
        spec$.complete();
        doCommit$.complete();
        return gathering;
    }


    function materialize<U>() : OperatorFunction<DoStore<U>, { data: Dict<U[]>, extent: number }[]> {
        return pipe(
                concatMap(({ data, extent }) => 
                    data.pipe(
                        concatMap(g => g.pipe(
                                        reduceToArray(),
                                        map(r => tup(g.key, r)))),
                        reduceToDict(),
                        map(data => ({ data, extent })))),
                reduceToArray()
            );
    }

})