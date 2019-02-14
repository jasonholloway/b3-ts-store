import { Observable, Subject, from, OperatorFunction, pipe, forkJoin, BehaviorSubject, of, empty } from "rxjs";
import { Dict, scanToArray, propsToArray, tup, reduceToDict } from "../lib/utils";
import { map, concatMap, toArray, startWith } from "rxjs/operators";
import { Era, pullAllSlices, SliceId, pullAll, Ripple, eraSlicer, newEpoch, emptyEra, Slice } from "../lib/core/eraSlicer";
import { emptyManifest, Signal, Manifest, setThreshold, refreshEra, doReset } from "../lib/core/signals";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { TestModel } from "./fakes/testModel";
import { pause } from "./utils";
import { emptyEvaluable } from "../lib/core/evaluable";

jest.setTimeout(500);

describe('eraSlicer', () => {

    let model = new TestModel();

    let blockStore: FakeBlockStore;

    let manifest$: Subject<Manifest>
    let ripple$: Subject<Ripple<number>>
    let signal$: Subject<Signal>

    let era$: Observable<Era<Ripple<number>>>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        manifest$ = new BehaviorSubject(emptyManifest);
        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple<number>>();

        const epoch$ = manifest$.pipe(
                        concatMap(manifest => 
                            of(manifest).pipe(
                                pullBlocks(blockStore),
                                evaluateBlocks(model),
                                map(evaluable => ({ manifest, ...evaluable }))
                            )));

        era$ = epoch$.pipe(
                eraSlicer(signal$, ripple$),
                pullAllSlices());
    })

    it('single slice appears in output', async () => {
        emit({ log1: [ 1, 2, 3 ] });
        
        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }]
            ]
        ])                
    })

    it('multiple slices appears in output', async () => {
        emit({ log1: [ 1, 2, 3 ] });
        emit({ log2: [ 4, 5, 6 ] });

        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }],
                [1, { log2: [ 4, 5, 6 ] }]
            ]
        ])                
    })

    describe('on new epoch', () => {
        beforeEach(() => {
            emit({ log1: [ 1, 2, 3 ] });
            signal$.next(newEpoch({
                manifest: emptyManifest
            }));
        })

        it('starts new era', () =>
            expectCurrSlices([
                [ 
                    [0, { log1: [ 1, 2, 3 ] }]
                ],
                []
            ]));

        it('era.from populated', () =>
            expectEras([
                { from: 0 },
                { from: 1 }
            ]));

        describe('on further ripples', () => {
            beforeEach(() => {
                emit({ log1: [ 4 ] });
            })

            it('slices appear in new era', () =>
                expectCurrSlices([
                    [
                        [0, { log1: [ 1, 2, 3 ] }]
                    ],
                    [
                        [1, { log1: [ 4 ] }]
                    ]
                ]));
        })
    })

    describe('on new epoch from commit', () => {
        beforeEach(() => {
            emit({ log1: [ 1 ] });
            emit({ log1: [ 2 ] });
            emit({ log1: [ 3 ] });
            signal$.next(newEpoch({
                manifest: emptyManifest,
                commit: {
                    id: '123',
                    data: {},
                    range: [0, 2],
                    era: emptyEra,
                    event$: empty()
                }
            }));
        })

        it('obsolete slices don\'t make cut', () => 
            expectSlices([
                [
                    [0, { log1: [ 1 ] }],
                    [1, { log1: [ 2 ] }],
                    [2, { log1: [ 3 ] }]
                ],
                [
                    [2, { log1: [ 3 ] }]
                ]
            ]));
    })

    it('slices combined into era', async () => {
        emit({ log1: [ 1, 2, 3 ] });
        emit({ log2: [ 4, 5, 6 ] });

        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }],
                [1, { log2: [ 4, 5, 6 ] }]
            ]
        ])
    })


    async function expectEras(expected: any[]) {
        complete();
        const eras = await era$.pipe(toArray()).toPromise();
        expect(eras).toMatchObject(expected);
    }


    async function expectSlices(expected: [SliceId, Dict<number[]>][][]) {
        complete();
        const eras = await era$.pipe(materializeEras()).toPromise();
        expect(eras).toMatchObject(expected);
    }

    async function expectCurrSlices(expected: [SliceId, Dict<number[]>][][]) {
        complete();

        const eras = await era$.pipe(
                                concatMap(({currSlice$}) => 
                                    currSlice$.pipe(materializeSlices())),
                                toArray()
                            ).toPromise();

        expect(eras).toMatchObject(expected);
    }

    function complete() {
        ripple$.complete();
        signal$.complete();
        manifest$.complete();
    }
    
    function emit(sl: Dict<number[]>) {
        ripple$.next(
             from(propsToArray(sl))
                 .pipe(map(([k, r]) => tup(k, from(r))))
        );
    }

    function materializeSlices() : OperatorFunction<Slice, any[]> {
        return pipe(
            concatMap(([sliceId, parts]) => parts.pipe(
                concatMap(([logRef, updates]) => updates.pipe(                                                                                                                            
                                                    toArray(),
                                                    map(r => tup(logRef, r)))),
                reduceToDict(),
                map(u => tup(sliceId, u)))),
            toArray());
    }

    function materializeEras() : OperatorFunction<Era, any> {
        return pipe(
            concatMap(({ slices }) =>
                slices.pipe(materializeSlices())),
            scanToArray());
    }

})


describe('eraSlicer as specifier', () => {

    let perform: () => Promise<void>

    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple>
    let manifest$: Subject<Manifest>
    let eras: Era[]

    beforeAll(() => {
        perform = async () => {}; 
    })


    beforeEach(async () => {
        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple>();
        manifest$ = new Subject<Manifest>();
        
        const epoch$ = manifest$.pipe(
                        startWith(emptyManifest),
                        concatMap(manifest => 
                            of(manifest).pipe(
                                pullBlocks(new FakeBlockStore()),
                                evaluateBlocks(new TestModel()),
                                map(evaluable => ({ manifest, ...evaluable }))
                            )));
                            
        [eras] = await forkJoin(
                        epoch$.pipe(
                            eraSlicer(signal$, ripple$),
                            toArray(),
                            pullAll()),
                        perform()
                            .then(complete))
                    .toPromise();
    })

    it('basic era', () => 
        expect(eras).toMatchObject([
            { id: 0, thresh: 0, epoch: { manifest: emptyManifest } }
        ]));


    describe('newEra', () => {
        beforeAll(() => {
            perform = async () => {
                signal$.next(refreshEra());
                signal$.next(refreshEra());
                await pause();
            }
        })

        it('triggers new era', () => 
            expect(eras).toMatchObject([
                { id: 0, thresh: 0, epoch: { manifest: emptyManifest } }, 
                { id: 1, thresh: 0, epoch: { manifest: emptyManifest } }, 
                { id: 2, thresh: 0, epoch: { manifest: emptyManifest } },
            ]))
    })

    describe('doReset', () => {
        beforeAll(() => {
            perform = async () => {
                emit({ myLog: [1] });
                emit({ myLog: [2] });
                signal$.next(doReset());
            }
        })

        it('triggers new era', () => 
            expect(eras).toMatchObject([
                { id: 0 }, 
                { id: 1 },
            ]))

        it('moves threshold past last slice', () =>         
            expect(eras).toMatchObject([
                { id: 0, thresh: 0 }, 
                { id: 1, thresh: 2 },
            ]))

    })

    describe('on epoch from commit', () => {
        beforeAll(() => {
            perform = async () => {
                signal$.next(
                    newEpoch({ 
                        manifest: emptyManifest, 
                        commit: { 
                            id: '123',
                            data: {},
                            era: emptyEra,
                            range: [0, 13],                            
                            event$: empty()                                                        
                        }
                    }, emptyEvaluable));
                
                signal$.next(
                    newEpoch({ 
                        manifest: emptyManifest, 
                        commit: { 
                            id: '124',
                            data: {},
                            era: emptyEra,
                            range: [13, 2],                            
                            event$: empty()                                                        
                        }
                    }, emptyEvaluable));
            }
        })

        it('shifts era thresholds', () =>
            expect(eras).toMatchObject([
                { id: 0, thresh: 0 },
                { id: 1, thresh: 13 },
                { id: 2, thresh: 15 }
            ]))
    })


    async function complete() {
        await pause();
        manifest$.complete();
        signal$.complete();
        ripple$.complete();
    }


    function emit(sl: Dict<number[]>) {
        ripple$.next(
             from(propsToArray(sl))
                 .pipe(map(([k, r]) => tup(k, from(r))))
        );
    }

})
