import { Subject, of, forkJoin } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { pullAll } from "../lib/slicer";
import { delay, startWith } from "rxjs/operators";
import { Signal, newEra, newManifest, setThreshold, specifier, EraWithSpec, emptyManifest } from "../lib/specifier";
import { pause } from "./utils";

jest.setTimeout(400);

describe('specifier', () => {

    let perform: () => Promise<void>
    let signal$: Subject<Signal>
    let eras: EraWithSpec[];

    beforeAll(() => {
        perform = async () => {}; 
    })

    beforeEach(async () => {
        signal$ = new Subject<Signal>();

        [eras] = await forkJoin(
                        signal$.pipe(
                            startWith(newEra()),
                            specifier(),
                            reduceToArray(),
                            pullAll()),
                        perform()
                            .then(complete))
                    .toPromise();
    })

    it('basic era', () => 
        expect(eras).toEqual([
            { id: 0, thresh: 0, manifest: emptyManifest }
        ]))


    describe('newEra', () => {
        beforeAll(() => {
            perform = async () => {
                signal$.next(newEra());
                signal$.next(newEra());
                await pause();
            }
        })

        it('triggers new era', () => 
            expect(eras).toEqual([
                { id: 0, thresh: 0, manifest: emptyManifest }, 
                { id: 1, thresh: 0, manifest: emptyManifest }, 
                { id: 2, thresh: 0, manifest: emptyManifest },
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
            expect(eras).toEqual([
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
                    id: 1,
                    logBlocks: {  
                        myLog: ['block0', 'block1']
                    } 
                }));
                await pause();
            }
        })

        it('triggers new era with new manifest', () =>
            expect(eras).toEqual([
                { 
                    id: 0, 
                    thresh: 0,
                    manifest: { 
                        id: 0,
                        logBlocks: { } 
                    }
                },
                { 
                    id: 1, 
                    thresh: 0,
                    manifest: {
                        id: 1,
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
