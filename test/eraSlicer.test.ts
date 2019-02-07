import { Observable, Subject, from, OperatorFunction, pipe, zip, merge, forkJoin, BehaviorSubject, of } from "rxjs";
import { Dict, scanToArray, propsToArray, reduceToArray, tup, reduceToDict } from "../lib/utils";
import { map, concatMap, toArray } from "rxjs/operators";
import { Era, pullAllSlices, SliceId, pullAll, Ripple, eraSlicer } from "../lib/core/eraSlicer";
import { emptyManifest, Signal, Manifest, setThreshold, refreshEra, doReset, newManifest } from "../lib/core/signals";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { TestModel } from "./fakes/testModel";
import { pause } from "./utils";

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
        ripple({ log1: [ 1, 2, 3 ] });
        
        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }]
            ]
        ])                
    })

    it('multiple slices appears in output', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });

        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }],
                [1, { log2: [ 4, 5, 6 ] }]
            ]
        ])                
    })

    it('on threshold move, starts new era', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        threshold(1);

        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }]
            ],
            []
        ])
    })


    it('new slices into new era', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        threshold(1);
        ripple({ log1: [ 4 ] });
        
        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }]
            ],
            [
                [1, { log1: [ 4 ] }]
            ]
        ])
    })

    it('obsolete slices disappear in new era', async () => {
        ripple({ log1: [ 1 ] });
        ripple({ log1: [ 2 ] });
        ripple({ log1: [ 3 ] })
        threshold(2);
        
        await expectSlices([
            [
                [0, { log1: [ 1 ] }],
                [1, { log1: [ 2 ] }],
                [2, { log1: [ 3 ] }]
            ],
            [
                [2, { log1: [ 3 ] }]
            ]
        ])
    })


    it('output slices can be combined', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });

        await expectSlices([
            [
                [0, { log1: [ 1, 2, 3 ] }],
                [1, { log2: [ 4, 5, 6 ] }]
            ]
        ])
    })


    it('era.from populated on new eras', async () => {
        ripple({ log1: [ 1, 2, 3 ] });
        ripple({ log2: [ 4, 5, 6 ] });
        threshold(0);
        
        await expectEras([
            { from: 0 },
            { from: 2 }
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

    function complete() {
        ripple$.complete();
        signal$.complete();
        manifest$.complete();
    }

    function threshold(n: number) {
        signal$.next(setThreshold(n));
    }
    
    function ripple(sl: Dict<number[]>) {
        ripple$.next(
             from(propsToArray(sl))
                 .pipe(map(([k, r]) => tup(k, from(r))))
        );
    }

    function materializeEras() : OperatorFunction<Era<Ripple<number>>, any> {
        return pipe(
            concatMap(({ slices }) => slices.pipe(
                concatMap(([sliceId, parts]) => parts.pipe(
                    concatMap(([logRef, updates]) => updates.pipe(                                                                                                                            
                                                        reduceToArray(),
                                                        map(r => tup(logRef, r)))),
                    reduceToDict(),
                    map(u => tup(sliceId, u)))),
                reduceToArray())),
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
        manifest$ = new BehaviorSubject(emptyManifest);
        
        const epoch$ = manifest$.pipe(
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
            { id: 0, thresh: 0, manifest: emptyManifest }
        ]))


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
                { id: 0, thresh: 0, manifest: emptyManifest }, 
                { id: 1, thresh: 0, manifest: emptyManifest }, 
                { id: 2, thresh: 0, manifest: emptyManifest },
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

    describe('setThreshold', () => {
        beforeAll(() => {
            perform = async () => {
                signal$.next(setThreshold(13));
                await pause();
            }
        })

        it('triggers new era with new threshold', () =>
            expect(eras).toMatchObject([
                { 
                    id: 0, 
                    thresh: 0,
                    manifest: emptyManifest
                },
                { 
                    id: 1, 
                    thresh: 13,
                    manifest: emptyManifest
                }
            ]))
    })


    describe('newManifest', () => {
        beforeAll(() => {
            perform = async () => {
                signal$.next(newManifest({
                    version: 1,
                    logBlocks: {  
                        myLog: ['block0', 'block1']
                    } 
                }));
                await pause();
            }
        })

        it('triggers new era with new manifest', () =>
            expect(eras).toMatchObject([
                { 
                    id: 0, 
                    thresh: 0,
                    manifest: { 
                        version: 0,
                        logBlocks: { } 
                    }
                },
                { 
                    id: 1, 
                    thresh: 0,
                    manifest: {
                        version: 1,
                        logBlocks: { 
                            myLog: ['block0', 'block1']
                        } 
                    }
                }
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
