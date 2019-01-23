import { Subject, of, forkJoin } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { pullAll } from "../lib/slicer";
import { concatMap, catchError, startWith } from "rxjs/operators";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { pullBlocks } from "../lib/pullBlocks";
import { Manifest, emptyManifest } from "../lib/specifier";

jest.setTimeout(400);

describe('pullBlocks', () => {

    let blockStore: FakeBlockStore
    let manifest$: Subject<Manifest>
    let results: any[]

    beforeAll(() => {
        blockStore = new FakeBlockStore();
    })

    beforeEach(async () => {
        manifest$ = new Subject<Manifest>();

        const frame$ = manifest$.pipe(
                        startWith(emptyManifest),
                        pullBlocks(blockStore),
                        pullAll());
                        
        [results] = await forkJoin(
                            frame$.pipe(
                                concatMap(frame =>
                                    frame.load('block0')('myLog')
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