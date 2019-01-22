import { Subject, Observable, of, forkJoin } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { pullAll } from "../lib/slicer";
import { concatMap, tap, catchError } from "rxjs/operators";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { EraWithBlocks, serveBlocks } from "../lib/serveBlocks";
import { Signal, specifier } from "../lib/specifier";

jest.setTimeout(400);

describe('serveBlocks', () => {

    let blockStore: FakeBlockStore

    let signal$: Subject<Signal>

    let era$: Observable<EraWithBlocks>

    let results: any[];

    beforeAll(() => {
        blockStore = new FakeBlockStore();
    })

    beforeEach(async () => {
        signal$ = new Subject<Signal>();

        era$ = signal$.pipe(
                    specifier(),
                    serveBlocks(blockStore),
                    pullAll());

        signal$.next(['NewManifest', { version: 0, logBlocks: {} }]);

        [results] = await forkJoin(
                            era$.pipe(
                                concatMap(era =>
                                    era.blocks.load('block0')('myLog')
                                        .pipe(catchError(err => of(err)))),
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
            expect(results).toEqual([1, 2, 3]));
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
            expect(results).toEqual([]))        
    })


    describe('no block in store', () => {        
        beforeAll(async () => {
            blockStore.blocks = {
                schlampt: {
                    wibble: []
                }
            };
        })

        it('returns error to caller', () =>
            expect(results[0]).toMatchObject(Error('Block not found!')));
            
    })
   

    async function complete() {
        await of().toPromise();
        signal$.complete();
    }

})