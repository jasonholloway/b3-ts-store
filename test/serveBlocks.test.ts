import { Subject, Observable, of, forkJoin } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { pullAll } from "../lib/slicer";
import { concatMap } from "rxjs/operators";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { EraWithBlocks, serveBlocks } from "../lib/serveBlocks";
import { Signal, specifier } from "../lib/specifier";
import { sinkErrors, EraWithErrors } from "../lib/sinkErrors";

jest.setTimeout(400);

describe('serveBlocks', () => {

    let blockStore: FakeBlockStore

    let signal$: Subject<Signal>
    let error$: Subject<Error>

    let era$: Observable<EraWithBlocks & EraWithErrors>

    let errors: Error[], blocks: any[];

    beforeAll(() => {
        blockStore = new FakeBlockStore();
    })

    beforeEach(async () => {
        signal$ = new Subject<Signal>();
        error$ = new Subject<Error>();

        era$ = signal$.pipe(
                    specifier(),
                    sinkErrors(error$),
                    serveBlocks(blockStore),
                    pullAll());

        signal$.next(['NewManifest', { version: 0, logBlocks: {} }]);

        [errors, blocks] = await forkJoin(
                                    error$.pipe(
                                        reduceToArray()), 
                                    era$.pipe(
                                        concatMap(era => era.blocks.load('block0')('myLog')),
                                        reduceToArray()),
                                    complete())
                                .toPromise();
    })

    afterEach(complete)


    describe('happy path', () => {
        beforeAll(() => {
            blockStore.blocks = {
                block0: {
                    myLog: [ 1, 2, 3 ]
                }
            };
        })

        it('block part loads', () =>
            expect(blocks).toEqual([1, 2, 3]));
    })

    
    describe('no log in block', () => {
        beforeAll(() => {
            blockStore.blocks = {
                block0: {
                    wibble: []
                }
            };
        })

        it('returns empty', () => 
            expect(blocks).toEqual([]))        
    })


    describe('no block in store', () => {        
        beforeAll(async () => {
            blockStore.blocks = {
                schlampt: {
                    wibble: []
                }
            };
        })

        it('returns empty', () =>
            expect(blocks).toEqual([]));

        it('sinks error', () => {
            expect(errors.length).toEqual(1);
            expect(errors[0].message).toMatch(/Block not found/);
        })
    })
   

    async function complete() {
        await of().toPromise();
        signal$.complete();
        error$.complete();
    }

})