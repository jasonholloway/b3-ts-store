import { Subject, from, MonoTypeOperatorFunction, zip, merge } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup } from "../lib/utils";
import { slicer, Ripple, mapSlices } from "../lib/slicer";
import { map, concatMap, groupBy, shareReplay, startWith } from "rxjs/operators";
import { evaluateSlices, KnownLogs } from "../lib/evaluateSlices";
import { TestModel } from "./fakes/testModel";
import { DoCommit } from "../lib/committer";
import { Viewer, createViewer } from "../lib/viewer";
import { specifier, Signal, newEra, emptyManifest, newManifest, Manifest } from "../lib/specifier";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { pullBlocks } from "../lib/pullBlocks";
import { newEpoch } from "../lib/createStore";
import { evaluateBlocks } from "../lib/evaluateBlocks";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('viewer', () => {

    const model = new TestModel();

    let blockStore: FakeBlockStore

    let manifest$: Subject<Manifest>
    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>

    let view: Viewer<TestModel>
    
    beforeEach(() => {
        blockStore = new FakeBlockStore();

        manifest$ = new Subject<Manifest>();
        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();

        const epoch$ = zip(
                        manifest$,
                        manifest$.pipe(
                            pullBlocks(blockStore),
                            evaluateBlocks(model))
                    ).pipe(map(e => newEpoch(...e)));

        const era$ = merge(epoch$, signal$).pipe(
                        startWith(newEra()),
                        specifier(),
                        slicer(ripple$),
                        evaluateSlices(model),
                        mapSlices(([_, evaluable]) => evaluable),
                        pullAll());

        manifest$.next(emptyManifest);

        view = createViewer(era$);
    })

    afterEach(() => complete())


    describe('single update', () => {
        it('emits view', async () => {
            emit({ myLog: [ 1 ] });
            await expectViews('myLog', [ '1' ]);
        })
    })

    describe('multiple values', () => {
        it('emits only latest view', async () => {
            emit({ myLog: [ 1, 2 ] });
            await expectViews('myLog', [ '1,2' ]);
        })
    })

    describe('across eras', () => {
        it('doesn\'t reemit if nothing changed', async () => {
            const viewing = getView('myLog');

            emit({ myLog: [ 13 ] });
            signal$.next(newEra());
            signal$.next(newManifest(emptyManifest));

            complete();

            expect(await viewing)
                .toEqual([ '13' ]);
        })
    })


    function getView(ref: KnownLogs<TestModel>) {
        return view(ref)
                .pipe(reduceToArray())
                .toPromise();
    }


    async function expectViews(ref: KnownLogs<TestModel>, expected: any[]) {
        complete();
        const r = await getView(ref);
        expect(r).toEqual(expected);
    }


    function emit(rip: TestRipple) {
        const ripple = from(enumerate(rip)).pipe(
                        concatMap(([k, r]) => from(r).pipe(map(v => tup(k, v)))),
                        groupBy(([k]) => k, ([_, v]) => v),
                        map(g => tup(g.key, g)));
                    
        ripple$.next(ripple);
    }

    function complete() {
        ripple$.complete();
        signal$.complete();
        doCommit$.complete();
    }

    function pullAll<V>() : MonoTypeOperatorFunction<V> {
        return v$ => {
            v$ = v$.pipe(shareReplay());
            v$.subscribe();
            return v$;
        }
    }

})

