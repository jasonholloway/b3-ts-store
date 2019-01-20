import { Subject, from, OperatorFunction, pipe, empty, Observable, Observer, GroupedObservable, of } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup } from "../lib/utils";
import { slicer, pullAll, Ripple, Part } from "../lib/slicer";
import { map, concatMap, groupBy, mapTo, tap, startWith, reduce, concatAll, concat, defaultIfEmpty } from "rxjs/operators";
import { evaluate } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, DoStore } from "../lib/committer";
import FakeManifestStore from "./fakes/FakeManifestStore";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { Signal, specifier, newEra, NewManifest } from "../lib/specifier";
import { serveBlocks } from "../lib/serveBlocks";
import { BlockStore, ManifestStore } from "../lib/bits";
import { pause } from "./utils";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

//the Pusher:
//1) saves a block
//2) tries to save a new Manifest
//3) on success, emits new Spec
//4) on failure, should emit an informational warning

const reduceToKeyedArrays =
    <V>(part$: Observable<Part<V>>) =>
    part$.pipe(
        reduce(
            (prev$, [k, u$]: Part<V>) => 
                prev$.pipe(
                    concatMap(prev =>
                        u$.pipe(
                            reduceToArray(),
                            map(r => ({ ...prev, [k]: r }))))
                ),
            of({} as Dict<V[]>)),
        concatAll()
    );


const pusher = 
    (blockStore: BlockStore, manifestStore: ManifestStore, newManifest$: Observer<NewManifest>) : OperatorFunction<DoStore<any>, any> =>
    pipe(
        concatMap(({ data }) => 
            data.pipe(reduceToKeyedArrays)),
        tap(block => console.log('BLOCK', block)),
        concatMap((block) => 
            blockStore.save('block0', block)),
        pullAll(false)
    );   


describe('saveLoad', () => {

    const model = new TestModel();

    let manifestStore: FakeManifestStore
    let blockStore: FakeBlockStore

    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>

    beforeEach(() => {
        manifestStore = new FakeManifestStore();
        blockStore = new FakeBlockStore();

        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = signal$.pipe(
                        startWith(newEra()),
                        specifier(),
                        serveBlocks(blockStore),
                        slicer(ripple$),
                        evaluate(model));

        era$.pipe(
            committer(model, doCommit$, signal$),
            pusher(blockStore, manifestStore, signal$));
    })


    it('pushes committed slice to blockStore', async () => {
        emit({ myLog: [ 1, 2, 3 ] });
        doCommit();

        await pause();
        complete();
        await pause();

        expect(blockStore.blocks)
            .toHaveProperty('block0', { myLog: [ 1, 2, 3 ] });
    })

    
    function emit(rip: TestRipple) {
        const ripple = from(enumerate(rip)).pipe(
                        concatMap(
                            ([k, r]) => from(r).pipe(map(v => tup(k, v)))),
                        groupBy(
                            ([k]) => k, 
                            ([_, v]) => v),
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
        signal$.complete();
        doCommit$.complete();
    }

})