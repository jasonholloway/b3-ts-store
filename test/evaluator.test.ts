import { slicer, pullAllSlices, Ripple, pullAll } from "../lib/core/slicer";
import { Subject, from, Observable, zip, merge } from "rxjs";
import { Dict, reduceToDict, tup, enumerate, log, concatMapEager } from "../lib/utils";
import { map, concatMap, groupBy, toArray, flatMap } from "rxjs/operators";
import { TestModel } from "./fakes/testModel";
import { specifier, emptyManifest, Manifest, setThreshold, Signal, newEra } from "../lib/core/specifier";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { newEpoch } from "../lib/core";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { evaluator, EvaluableEra } from "../lib/core/evaluator";
import { LogRef, KnownLogs } from "../lib/core/evaluateSlices";
import { pause } from "./utils";


describe('evaluator', () => {

    const model = new TestModel();

    let manifest$: Subject<Manifest>
    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple<number>>
    let blockStore: FakeBlockStore

    let era$: Observable<EvaluableEra<TestModel>>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        manifest$ = new Subject<Manifest>();
        signal$= new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();

        const epoch$ = zip(
                        manifest$,
                        manifest$.pipe(
                            pullBlocks(blockStore),
                            evaluateBlocks(model))
                    ).pipe(map(e => newEpoch(...e)));

        era$ = merge(signal$, epoch$).pipe(
                    specifier(),
                    slicer(ripple$),
                    evaluator(model),
                    pullAllSlices());


        manifest$.next(emptyManifest);
    })


    describe('logRefs', () => {
        it('advertises known log refs', async () => {
            ripple({ myLog: [1, 2], myLog2: [ 9 ] });
        
            await expectLogRefs([
                ['myLog', 'myLog2']
            ]);
        })

        it('ignores log refs without updates', async () => {
            ripple({ myLog: [], myLog2: [ 9 ] });
        
            await expectLogRefs([
                ['myLog2']
            ]);
        })

        it('includes logRefs of eras within threshold', async () => {
            ripple({ myLog: [1] });
            signal$.next(newEra());
            ripple({ myLog2: [1] });

            await expectLogRefs([
                ['myLog'],
                ['myLog', 'myLog2']
            ]);
        })

        it('excludes logRefs of eras before threshold', async () => {
            ripple({ myLog: [1] });
            signal$.next(setThreshold(1));
            ripple({ myLog2: [1] });

            await expectLogRefs([
                ['myLog'],
                ['myLog2']
            ]);
        })

        it('dedupes logRefs', async () => {
            ripple({ myLog: [1, 2], myLog2: [ 9 ] });
            ripple({ myLog: [1, 2], myLog2: [ 9 ] });
            ripple({ myLog: [1, 2], myLog2: [ 9 ] });
        
            await expectLogRefs([
                ['myLog', 'myLog2']
            ]);
        })

    })


    describe('evaluate', () => {

        it('returns zero by default', async () => {
            complete();

            expect(await view('myLog'))
                .toEqual(['']);
        })

        it('single slice', async () => {
            const viewing = view('myLog');

            ripple({ myLog: [1, 2] });
            complete();

            expect(await viewing)
                .toEqual(['', '1,2']);
        })
        
        it('multiple slices', async () => {
            const viewing = view('myLog');

            ripple({ myLog: [1, 2] });
            ripple({ myLog: [3, 4] });
            complete();
    
            expect(await viewing)
                .toEqual(['', '1,2', '1,2,3,4']);

            //all the slices go past before the evaluation
            //like there's some dependency
            //
            //
        })

        it('only emits from latest slice on', async () => {
            ripple({ myLog: [1, 2] });
            ripple({ myLog: [3, 4] });

            const viewing = view('myLog');

            ripple({ myLog: [5, 6] });
            complete();

            expect(await viewing)
                .toEqual([
                    '3,4', '3,4,5,6'
                ]);
        })

        it('ignores before threshold', async () => {
            const viewing = view('myLog');

            ripple({ myLog: [1, 2] });
            ripple({ myLog: [3, 4] });
            signal$.next(setThreshold(1));
            complete();

            expect(await viewing)
                .toEqual([
                    '',
                    '1,2',
                    '1,2,3,4',
                    '3,4'
                ]);
        })

        it('loads blocks first, given manifest', async () => {
            ripple({ myLog: [ 5, 6 ] });

            blockStore.blocks = {
                block0: { myLog: [ 1, 2 ] },
                block1: { myLog: [ 3, 4 ] }
            };

            manifest$.next({
                version: 1,
                logBlocks: {
                    myLog: ['block0', 'block1']
                }
            });

            complete();

            expect(await view('myLog'))
                .toEqual([
                    '',
                    '5,6',
                    '1,2,3,4,5,6'
                ]);
        })

    })


    describe('when strange log encountered', () => {

        it('not listed in logRefs', async () => {
            ripple({ flibble: [1] });

            await expectLogRefs([
                []
            ]);
        })

    })


    function view(ref: KnownLogs<TestModel>): Promise<any[]> {
        return era$.pipe(
                concatMap(era => era.evaluate(ref)),
                toArray())
            .toPromise();
    }


    function ripple(rip: Dict<number[]>) {
        const ripple = from(enumerate(rip)).pipe(
                            concatMap(([k, r]) => from(r).pipe(
                                                    map(v => tup(k, v)))),
                            groupBy(([k, _]) => k, ([_, v]) => v),
                            map(g => tup(g.key, g)));
                    
        ripple$.next(ripple);
    }

    function complete() {
        ripple$.complete();
        manifest$.complete();
    }



    async function expectLogRefs(expected: string[][]) {
        complete();

        const r = await era$.pipe(
                            concatMap(era =>
                                era.logRef$.pipe(toArray())),
                            toArray()
                        ).toPromise();

        expect(r).toEqual(expected);
    }

})



