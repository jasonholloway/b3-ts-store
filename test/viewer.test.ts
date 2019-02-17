import { Subject, from, of } from "rxjs";
import { Dict, propsToArray, tup } from "../lib/utils";
import { map, concatMap, groupBy, startWith } from "rxjs/operators";
import { DoCommit } from "../lib/core/committer";
import { Viewer, createViewer } from "../lib/core/viewer";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { pullBlocks } from "../lib/core/pullBlocks";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { evaluator } from "../lib/core/evaluator";
import { gather } from "./helpers";
import { Manifest, Signal, emptyManifest, refreshEra } from "../lib/core/signals";
import { Ripple, pullAll, eraSlicer } from "../lib/core/eraSlicer";
import { testModel as model } from "./fakes/testModel";
import { KnownLogs } from "../lib/model";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('viewer', () => {

    let blockStore: FakeBlockStore

    let manifest$: Subject<Manifest>
    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>

    let view: Viewer<typeof model>
    
    beforeEach(() => {
        blockStore = new FakeBlockStore();

        manifest$ = new Subject();
        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();

        const epoch$ = manifest$.pipe(
            startWith(emptyManifest),
            concatMap(manifest => 
                of(manifest).pipe(
                    pullBlocks(blockStore),
                    evaluateBlocks(model),
                    map(evaluable => ({ manifest, ...evaluable }))
                )));

        const era$ = epoch$.pipe(
                        eraSlicer(signal$, ripple$),
                        evaluator(model),
                        pullAll());

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

        xit('doesn\'t reemit if nothing changed', async () => {
            //below would require filtering by viewer itself,
            //which means me need some concept of view-level etag
            //(ref:head:sliceRange) - and ref is redundant here, as we've already specified it

            const viewing = getView('myLog');

            emit({ myLog: [ 13 ] });
            signal$.next(refreshEra());

            complete();

            expect(await viewing)
                .toEqual([ '', '13' ]);
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


    function getView(ref: KnownLogs<typeof model>) {
        return gather(view(ref));
    }


    async function expectViews(ref: KnownLogs<typeof model>, expected: any[]) {        
        complete();
        expect(await getView(ref)).toEqual(expected);
    }


    function emit(rip: TestRipple) {
        const ripple = from(propsToArray(rip)).pipe(
                        concatMap(([k, r]) => from(r).pipe(map(v => tup(k, v)))),
                        groupBy(([k]) => k, ([_, v]) => v),
                        map(g => tup(g.key, g)));
                    
        ripple$.next(ripple);
    }

    function complete() {
        manifest$.complete();
        ripple$.complete();
        signal$.complete();
        doCommit$.complete();
    }

})

