import { Subject, Observable, of, forkJoin, zip } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { pullAll, Era } from "../lib/slicer";
import { concatMap, catchError, map } from "rxjs/operators";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { serveBlocks } from "../lib/serveBlocks";
import { specifier, Manifest } from "../lib/specifier";
import { newEpoch } from "../lib/createStore";

jest.setTimeout(400);

describe('serveBlocks', () => {

    let blockStore: FakeBlockStore

    let manifest$: Subject<Manifest>

    let era$: Observable<Era>

    let results: any[];

    beforeAll(() => {
        blockStore = new FakeBlockStore();
    })

    beforeEach(async () => {
        manifest$ = new Subject<Manifest>();

        const epoch$ = zip(
                        manifest$,
                        manifest$.pipe(serveBlocks(blockStore))
                        ).pipe(map(e => newEpoch(...e)));

        era$ = epoch$.pipe(
                    specifier(),
                    pullAll());

        manifest$.next({ version: 0, logBlocks: {} });

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
        manifest$.complete();
    }

})