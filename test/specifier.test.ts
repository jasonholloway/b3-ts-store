import { Subject, of, forkJoin } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { pullAll, Era } from "../lib/core/slicer";
import { delay, startWith } from "rxjs/operators";
import { Signal, newEra, newManifest, setThreshold, specifier, emptyManifest } from "../lib/core/specifier";
import { pause } from "./utils";

jest.setTimeout(400);

describe('specifier', () => {

    let perform: () => Promise<void>
    let signal$: Subject<Signal>
    let eras: Era[];

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
        expect(eras).toMatchObject([
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
            expect(eras).toMatchObject([
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
