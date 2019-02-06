import { Subject, from, Observable, zip, BehaviorSubject } from "rxjs";
import { Dict, tup, propsToArray } from "../lib/utils";
import { map, concatMap, groupBy, toArray } from "rxjs/operators";
import { TestModel } from "./fakes/testModel";
import { Manifest, setThreshold, Signal, refreshEra, emptyManifest } from "../lib/core/signals";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { evaluator, EvaluableEra } from "../lib/core/evaluator";
import { KnownLogs } from "../lib/core/evaluable";
import { eraSlicer, Ripple, pullAllSlices } from "../lib/core/eraSlicer";


describe('evaluator', () => {

    const model = new TestModel();

    let manifest$: Subject<Manifest>
    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple<number>>
    let blockStore: FakeBlockStore

    let era$: Observable<EvaluableEra<TestModel>>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        manifest$ = new BehaviorSubject(emptyManifest);
        signal$= new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();

        const epoch$ = zip(
                        manifest$,
                        manifest$.pipe(
                            pullBlocks(blockStore),
                            evaluateBlocks(model)));

        era$ = epoch$.pipe(
                    eraSlicer(signal$, ripple$),
                    evaluator(model),
                    pullAllSlices());
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
            signal$.next(refreshEra());
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
        })

        it('only emits from latest slice on', async () => {
            ripple({ myLog: [1] });
            ripple({ myLog: [2] });

            const viewing = view('myLog');

            ripple({ myLog: [3] });
            complete();

            expect(await viewing)
                .toEqual([
                    '1,2', '1,2,3'
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
            const viewing = view('myLog');

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

            expect(await viewing)
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
        const ripple = from(propsToArray(rip)).pipe(
                            concatMap(([k, r]) => from(r).pipe(
                                                    map(v => tup(k, v)))),
                            groupBy(([k, _]) => k, ([_, v]) => v),
                            map(g => tup(g.key, g)));
                    
        ripple$.next(ripple);
    }

    function complete() {
        manifest$.complete();
        signal$.complete();
        ripple$.complete();
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



