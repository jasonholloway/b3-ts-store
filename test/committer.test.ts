import { Subject, from, OperatorFunction, pipe } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, reduceToDict } from "../lib/utils";
import { slicer, Ripple, EraWithSlices } from "../lib/slicer";
import { map, concatMap, groupBy } from "rxjs/operators";
import { evaluate } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, Commit } from "../lib/committer";
import { EraWithSpec, emptyManifest } from "../lib/specifier";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { serveBlocks } from "../lib/serveBlocks";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('committer', () => {

    const model = new TestModel();
    let blockStore: FakeBlockStore

    let spec$: Subject<EraWithSpec>
    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>
    let gathering: Promise<{ data: Dict<number[]>, extent: number, errors: Subject<Error>, era: EraWithSpec }[]>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        spec$ = new Subject<EraWithSpec>();
        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = spec$.pipe(
                        slicer(ripple$),
                        serveBlocks(blockStore),
                        evaluate(model));

        gathering = doCommit$.pipe(
                        committer(model, era$, null),
                        materialize())
                    .toPromise();

        spec$.next({ id: 0, thresh: 0, manifest: emptyManifest });
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
                        groupBy(([k]) => k, ([_, v]) => v),
                        map(g => tup(g.key, g)));
                    
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


    function materialize() : OperatorFunction<Commit, { data: Dict<any[]>, extent: number, errors:Subject<Error>, era: EraWithSpec }[]> {
        return pipe(
                concatMap((commit) => 
                    commit.data.pipe(
                        concatMap(([k, u$]) => 
                            u$.pipe(
                                reduceToArray(),
                                map(r => tup(k, r)))),
                        reduceToDict(),
                        map(data => ({ ...commit, data })))),
                reduceToArray()
            );
    }

})