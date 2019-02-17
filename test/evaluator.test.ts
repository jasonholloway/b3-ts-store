import { Subject, from, Observable, of } from "rxjs";
import { Dict, tup, propsToArray } from "../lib/utils";
import { map, concatMap, groupBy, toArray, startWith } from "rxjs/operators";
import { setThreshold, Signal, emptyManifest } from "../lib/core/signals";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { evaluator, EvaluableEra } from "../lib/core/evaluator";
import { eraSlicer, Ripple, pullAllSlices, Epoch } from "../lib/core/eraSlicer";
import { pause } from "./utils";
import { testModel as model } from "./fakes/testModel";
import { KnownLogs } from "../lib/model";


describe('evaluator', () => {

    let epoch$: Subject<Epoch>
    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple<number>>
    let blockStore: FakeBlockStore

    let era$: Observable<EvaluableEra<typeof model>>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        epoch$ = new Subject<Epoch>();
        signal$= new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();

        const evalEpoch$ = epoch$.pipe(
                            startWith({ manifest: emptyManifest }),
                            concatMap(epoch => 
                                of(epoch.manifest).pipe(
                                    pullBlocks(blockStore),
                                    evaluateBlocks(model),
                                    map(evaluable => ({ ...epoch, ...evaluable }))
                                )));

        era$ = evalEpoch$.pipe(
                eraSlicer(signal$, ripple$),
                evaluator(model),
                pullAllSlices());
    })


    describe('logRefs', () => {
        it('advertises known log refs', async () => {
            emit({ myLog: [1, 2], myLog2: [ 9 ] });
        
            await expectLogRefs([
                ['myLog', 'myLog2']
            ]);
        })

        it('ignores log refs without updates', async () => {
            emit({ myLog: [], myLog2: [ 9 ] });
        
            await expectLogRefs([
                ['myLog2']
            ]);
        })

        it('includes logRefs of eras within threshold', async () => {
            emit({ myLog: [1] });
            await pause();
            epoch$.next({ manifest: emptyManifest });
            await pause();
            emit({ myLog2: [1] });

            await expectLogRefs([
                ['myLog'],
                ['myLog', 'myLog2']
            ]);
        })

        it('excludes logRefs of eras before threshold', async () => {
            emit({ myLog: [1] });
            signal$.next(setThreshold(1));
            emit({ myLog2: [1] });

            await expectLogRefs([
                ['myLog'],
                ['myLog2']
            ]);
        })

        it('dedupes logRefs', async () => {
            emit({ myLog: [1, 2], myLog2: [ 9 ] });
            emit({ myLog: [1, 2], myLog2: [ 9 ] });
            emit({ myLog: [1, 2], myLog2: [ 9 ] });
        
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

            emit({ myLog: [1, 2] });

            await pause();
            complete();

            expect(await viewing)
                .toEqual(['', '1,2']);
        })
        
        it('multiple slices', async () => {
            const viewing = view('myLog');

            emit({ myLog: [1, 2] });
            emit({ myLog: [3, 4] });
            complete();
    
            expect(await viewing)
                .toEqual(['', '1,2', '1,2,3,4']);
        })

        it('only emits from latest slice on', async () => {
            emit({ myLog: [1] });
            emit({ myLog: [2] });

            const viewing = view('myLog');

            emit({ myLog: [3] });
            complete();

            expect(await viewing)
                .toEqual([
                    '1,2', '1,2,3'
                ]);
        })

        it('ignores before threshold', async () => {
            const viewing = view('myLog');

            emit({ myLog: [1, 2] });
            emit({ myLog: [3, 4] });
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

            emit({ myLog: [ 5, 6 ] });

            blockStore.blocks = {
                block0: { myLog: [ 1, 2 ] },
                block1: { myLog: [ 3, 4 ] }
            };

            epoch$.next({
                manifest: {
                    version: 1,
                    logBlocks: {
                        myLog: ['block0', 'block1']
                    }
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
            emit({ flibble: [1] });

            await expectLogRefs([
                []
            ]);
        })

    })


    function view(ref: KnownLogs<typeof model>): Promise<any[]> {
        return era$.pipe(
                concatMap(era => era.evaluate(ref)),
                toArray())
            .toPromise();
    }


    function emit(rip: Dict<number[]>) {
        const ripple = from(propsToArray(rip)).pipe(
                            concatMap(([k, r]) => from(r).pipe(
                                                    map(v => tup(k, v)))),
                            groupBy(([k, _]) => k, ([_, v]) => v),
                            map(g => tup(g.key, g)));
                    
        ripple$.next(ripple);
    }

    function complete() {
        epoch$.complete();
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



