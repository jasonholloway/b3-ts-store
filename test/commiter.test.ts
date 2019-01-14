import { Subject, Observable, MonoTypeOperatorFunction } from "rxjs";
import { reduceToArray, Dict } from "../lib/utils";
import { Era, sliceByEra, EraSpec, Slice } from "../lib/sliceByEra";
import { withLatestFrom, map, share, mapTo, concatMap, take, tap, flatMap, scan } from "rxjs/operators";

type TestRipple = Dict<number[]>

type DoCommit = {}

type DoStore<V> = {
    slice: Slice<V>
}

function committer<V>(era$: Observable<Era<V>>, doCommit$: Observable<DoCommit>) {
    doCommit$ = doCommit$.pipe(share());

    const doStore$ = doCommit$.pipe(
                        withLatestFrom(era$),
                        concatMap(([_, [, slices]]) => 
                            slices.pipe(
                                take(1),
                                map(slice => ({ slice })))),
                        share());
    return {
        doStore$,
        newEra$: doStore$.pipe(map(() => {}))
    }
}


jest.setTimeout(400);

describe('committer', () => {

    let spec$: Subject<EraSpec>
    let ripple$: Subject<TestRipple>
    let doCommit$: Subject<DoCommit>
    let gathering: Promise<DoStore<TestRipple>[]>

    beforeEach(() => {
        spec$ = new Subject<EraSpec>();
        ripple$ = new Subject<TestRipple>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = spec$.pipe(sliceByEra(ripple$));

        const { doStore$, newEra$ } = committer(era$, doCommit$);

        newEra$.pipe(scan<void, number>((ac, _) => ac + 1, 0))
            .subscribe(spec$);

        gathering = doStore$
                    .pipe(reduceToArray())
                    .toPromise();

        spec$.next(0);
    })

    

    it('stores first slice', async () => {
        ripple({ a: [ 1, 2 ] });
        ripple({ b: [ 1 ] });
        doCommit();

        await expectStores([{
            slice: [[0, 1], { a: [ 1, 2 ] }]
        }]);
    })

    it('does nothing if no slices', async () => {
        doCommit();

        await expectStores([]);
    })

    it('only commits if slice known good', async () => {
        ripple({ a: [ 1, 2 ] });
        doCommit();



        await expectStores([]);
    })


    function ripple(rip: TestRipple) {
        ripple$.next(rip);
    }

    function doCommit() {
        doCommit$.next();
    }


    async function expectStores(doStores: DoStore<TestRipple>[]) {
        const r = await complete();
        expect(r).toEqual(doStores);
    }

    function complete() {
        ripple$.complete();
        spec$.complete();
        doCommit$.complete();
        return gathering;
    }

})