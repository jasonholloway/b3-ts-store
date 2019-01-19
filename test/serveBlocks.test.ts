import { Subject, OperatorFunction, pipe, Observable, Observer, of, forkJoin } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { EraWithThresh, pullAll } from "../lib/slicer";
import { map, concatMap, mapTo } from "rxjs/operators";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { EraWithErrors, EraWithBlocks, serveBlocks } from "../lib/serveBlocks";
import { Signal } from "../lib/specifier";


jest.setTimeout(400);


function sinkErrors
    <I extends object, O extends EraWithErrors & I>
    (sink: Observer<Error>) : OperatorFunction<I, O> 
{
    return pipe(
        map(era => ({
            ...era as object,
            errors: sink
        } as O))
    );
}


function specifier() : OperatorFunction<Signal, EraWithThresh> {
    return signal$ => {
        return signal$.pipe(
            mapTo({ id: 0, thresh: 0 })
            //scan<EraCommand, number>((ac, _) => ac + 1, -1)
        );
    }
}


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

        signal$.next(['NewManifest', {}]);

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