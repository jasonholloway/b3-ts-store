import { Subject, of, forkJoin, Observable, empty, OperatorFunction, pipe } from "rxjs";
import { reduceToArray, tup } from "../lib/utils";
import { pullAll, Era, Ripple, slicer, EraWithSlices } from "../lib/core/slicer";
import { delay, startWith, toArray, scan, concatAll, concatMap, map, withLatestFrom } from "rxjs/operators";
import { Signal, refreshEra, newManifest, setThreshold, specifier, emptyManifest, doReset } from "../lib/core/specifier";
import { pause } from "./utils";

jest.setTimeout(400);

describe('specifier', () => {

    let perform: () => Promise<void>

    let signal$: Subject<Signal>
    let ripple$: Subject<Ripple>
    let era$: Observable<EraWithSlices>;

    beforeAll(() => {
        perform = async () => {}; 
    })


    function scanLatest<Ac, V>(fn: (ac: Ac, v: V) => Observable<Ac>) : OperatorFunction<V, Ac> {
        return pipe(
            scan(
                (ac$: Observable<Ac>, v: V) =>
                    ac$.pipe(
                        map(ac => tup(ac, v)),
                        fn),
                empty()
            ),
            concatAll()
        );
    }


    beforeEach(async () => {
        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Ripple>();

        era$ = signal$.pipe(
                startWith(refreshEra()),
                specifier(era$),
                slicer(ripple$));
        
        [eras] = await forkJoin(
                        signal$.pipe(
                            startWith(refreshEra()),
                            specifier(),
                            slicer(ripple$),
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
                { id: 0 }, 
                { id: 1 },
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
        signal$.complete();
    }

})
