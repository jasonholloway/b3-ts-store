import { Subject, from, OperatorFunction, pipe, empty, Observable, of } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, reduceToDict } from "../lib/utils";
import { slicer, EraSpec, Era } from "../lib/slicer";
import { map, concatMap, scan, groupBy, mapTo, tap } from "rxjs/operators";
import { evaluate, Model, Era$, Evaluable } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, DoStore } from "../lib/committer";
import { ManifestStore, BlockStore } from "../lib/bits";
import FakeManifestStore from "./fakes/FakeManifestStore";
import FakeBlockStore from "./fakes/FakeBlockStore";

type TestRipple = Dict<number[]>

jest.setTimeout(400);


function pusher(manifests: ManifestStore, blocks: BlockStore) : OperatorFunction<DoStore<any>, any> {
    //the Pusher:
    //1) saves a block
    //2) tries to save a new Manifest
    //3) on success, emits new Spec
    //4) on failure, should emit an informational warning

    throw 432;
}

//as well storing, we want to have a go at loading from the stores too
//this will be done by the evaluator, with some resource made available to it by
//an as-yet-unconceived preceding stage
//
//as we don't have this yet, what shall we do? we can beaver away to get a loop in place
//


type Signal = void

function specifier() : OperatorFunction<Signal, EraSpec> {
    return signal$ => {
        return signal$.pipe(
            mapTo(0)
            //scan<EraCommand, number>((ac, _) => ac + 1, -1)
        );
    }
}



//an era isn't a signal
//
//
//
//

function patch<
    A, AK extends string, I extends { [key in AK]?: A } = { [key in AK]?: A }, 
    B = A, BK extends string = AK, O extends { [key in BK]?: B } = { [key in BK]?: B }>
    (fn: (source: { [key in AK]: Observable<A> }) => { [key in BK]: Observable<B> }) : OperatorFunction<I, O> {
        throw 123;
    }


    
const blockLoader = <V>() => 
    patch(({ era$ }: { era$: Observable<Era<V>> }) => {
        return {
            a$: era$.pipe(),
            b$: empty()
        };
    })

    



function loadBlocks<V>() : OperatorFunction<Era<V>, Era<V>> {
    return pipe(
        map(era => era)
    );
}



describe('saveLoad', () => {

    const model = new TestModel();

    let manifests: FakeManifestStore
    let blocks: FakeBlockStore

    let signal$: Subject<Signal>
    let ripple$: Subject<Keyed$<number>>
    let doCommit$: Subject<DoCommit>
    let gathering: Promise<{ data: Dict<number[]>, extent: number }[]>

    beforeEach(() => {
        manifests = new FakeManifestStore();
        blocks = new FakeBlockStore();

        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Keyed$<number>>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = signal$.pipe(
                        specifier(),
                        slicer(ripple$),
                        loadBlocks(),
                        evaluate(model));

        era$.pipe(
            committer(doCommit$, signal$),
            pusher(manifests, blocks))
            .subscribe(signal$);

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