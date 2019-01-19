import { Subject, from, OperatorFunction, pipe, empty, Observable, Observer } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, reduceToDict } from "../lib/utils";
import { slicer } from "../lib/slicer";
import { map, concatMap, groupBy, mapTo, tap } from "rxjs/operators";
import { evaluate } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, DoStore } from "../lib/committer";
import FakeManifestStore from "./fakes/FakeManifestStore";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { Signal, specifier } from "../lib/specifier";
import { serveBlocks } from "../lib/serveBlocks";

type TestRipple = Dict<number[]>

jest.setTimeout(400);


function pusher() : OperatorFunction<DoStore<any>, any> {
    //the Pusher:
    //1) saves a block
    //2) tries to save a new Manifest
    //3) on success, emits new Spec
    //4) on failure, should emit an informational warning

    throw 432;
}
   


xdescribe('saveLoad', () => {

    const model = new TestModel();

    let manifests: FakeManifestStore
    let blockStore: FakeBlockStore

    let signal$: Subject<Signal>
    let ripple$: Subject<Keyed$<number>>
    let doCommit$: Subject<DoCommit>
    let gathering: Promise<{ data: Dict<number[]>, extent: number }[]>

    beforeEach(() => {
        manifests = new FakeManifestStore();
        blockStore = new FakeBlockStore();

        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Keyed$<number>>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = signal$.pipe(
                        specifier(),
                        serveBlocks(blockStore),
                        slicer(ripple$),
                        evaluate(model));

        era$.pipe(
            committer(model, doCommit$, signal$),
            pusher());

        era$.pipe(
                tap(era => era.slices.pipe(tap(([,{evaluate}]) => evaluate('myLog'))))
            )


        signal$.next();
    })


    it('stores first slice', async () => {
        emit({ a: [ 1, 2 ] });
        emit({ b: [ 1 ] });
        doCommit();

        await expectStores([{
            data: { a: [ 1, 2 ] },
            extent: 1
        }]);
    })

    



    function emit(rip: TestRipple) {
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
        signal$.complete();
        doCommit$.complete();
        return gathering;
    }



})