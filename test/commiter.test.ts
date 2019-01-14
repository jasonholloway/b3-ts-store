import { Subject, Observable } from "rxjs";
import { reduceToArray, Dict } from "../lib/utils";
import { Era, sliceByEra, EraSpec, Slice } from "../lib/sliceByEra";
import { withLatestFrom, map, share, mapTo, concatMap, take } from "rxjs/operators";

type TestRipple = Dict<number[]>

type DoCommit = {}

type DoStore<V> = {
    slice: Slice<V>
}

//TO DO:
//refreshEra command (currently tests are bodged)


function committer<V>(era$: Observable<Era<V>>, doCommit$: Observable<DoCommit>) {
    doCommit$ = doCommit$.pipe(share());

    const doStore$ = doCommit$.pipe(
                        withLatestFrom(era$),
                        concatMap(([_, [, slices]]) => 
                            slices.pipe(
                                take(1),
                                map(slice => ({ slice }))))
                        );

    return {
        doStore$,
        refreshEra$: doStore$.pipe(mapTo(null))
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

        const { doStore$ } = committer(era$, doCommit$);

        gathering = doStore$
                    .pipe(reduceToArray())
                    .toPromise();

        spec$.next(0);
    })

    

    it('stores first slice', async () => {
        ripple({ a: [ 1, 2 ] });
        ripple({ b: [ 1 ] });
        doCommit();
        spec$.next(1);

        await expectStores([{
            slice: [[0, 1], { a: [ 1, 2 ] }]
        }]);
    })

    it('does nothing if no slices', async () => {
        doCommit();
        spec$.next(1);

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
        spec$.complete();
        ripple$.complete();
        doCommit$.complete();
        return gathering;
    }

})