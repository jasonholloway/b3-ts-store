import { Subject, from, MonoTypeOperatorFunction, zip, merge } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup } from "../lib/utils";
import { slicer, Ripple, mapSlices, pullAll } from "../lib/core/slicer";
import { map, concatMap, groupBy, shareReplay, startWith, toArray } from "rxjs/operators";
import { evaluateSlices, KnownLogs } from "../lib/core/evaluateSlices";
import { TestModel } from "./fakes/testModel";
import { DoCommit } from "../lib/core/committer";
import { Viewer, createViewer } from "../lib/core/viewer";
import { specifier, Signal, newEra, emptyManifest, newManifest, Manifest } from "../lib/core/specifier";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { pullBlocks } from "../lib/core/pullBlocks";
import { newEpoch } from "../lib/core";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { evaluator } from "../lib/core/evaluator";
import { gather } from "./helpers";

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
                        evaluator(model),
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

    describe('from blocks', () => {

        beforeEach(() => {
            blockStore.blocks.block1 = {
                myLog3: [ 1, 2, 3]
            };

            manifest$.next({
                version: 2,
                logBlocks: {
                    myLog3: [ 'block1' ]
                }
            });
        })

        it('views blocks too', async () => {
            await expectViews('myLog3', [ '1,2,3' ]);
        })

    })


    function getView(ref: KnownLogs<TestModel>) {
        return gather(view(ref));
    }


    async function expectViews(ref: KnownLogs<TestModel>, expected: any[]) {        
        complete();
        expect(await getView(ref)).toEqual(expected);
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

})

