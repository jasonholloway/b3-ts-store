import { Subject, from, OperatorFunction, pipe, empty, Observable, Observer, GroupedObservable, of, ReplaySubject, Subscriber, forkJoin } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, reduceToDict } from "../lib/utils";
import { slicer, EraSpec, EraWithThresh, EraWithSlices, pullAllSlices, pullAll } from "../lib/slicer";
import { map, concatMap, groupBy, mapTo, tap, flatMap, single, catchError, shareReplay, subscribeOn, delay } from "rxjs/operators";
import { evaluate, Evaluable, KnownLogs, LogRef } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, DoStore } from "../lib/committer";
import { ManifestStore, BlockStore } from "../lib/bits";
import FakeManifestStore from "./fakes/FakeManifestStore";
import FakeBlockStore from "./fakes/FakeBlockStore";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

type RefreshEra = ['RefreshEra']

type NewManifest = ['NewManifest', {}]

type Signal = RefreshEra | NewManifest


type BlockRef = string


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
            mapTo({ thresh: 0 })
            //scan<EraCommand, number>((ac, _) => ac + 1, -1)
        );
    }
}
    
interface EraWithErrors {
    errors: Observer<Error>
}

interface EraWithBlocks { 
    blocks: BlockFrame
}

interface BlockFrame {
    load: (blockRef: BlockRef) => (logRef: LogRef) => Observable<any>
}


function divertErrors<V>(era: EraWithErrors, fallback: Observable<V> = empty()) {
    return catchError(err => {
        era.errors.next(err);
        return fallback;
    });
}


function serveBlocks
    <I extends EraWithThresh & EraWithErrors, O extends EraWithBlocks & I>
    (blockStore: BlockStore) : OperatorFunction<I, O>
{
    return pipe(
        map(era => ({
            ...era as object, 
            blocks: {
                load: (blockRef: BlockRef) => (logRef: LogRef) =>
                        from(blockStore.load(blockRef))                            
                            .pipe(
                                divertErrors(era, of({})),                  //but if this defaulting to serving nothing
                                concatMap(b => b[logRef] || empty()))       //that'd then mean big chunks of data would be lost

            } as BlockFrame
        } as O))
    );
}



describe('serveBlocks', () => {

    let manifestStore: FakeManifestStore
    let blockStore: FakeBlockStore

    let signal$: Subject<Signal>
    let error$: Subject<Error>

    let era$: Observable<EraWithBlocks & EraWithErrors>

    let errors: Error[], blocks: any[];

    beforeAll(() => {
        manifestStore = new FakeManifestStore();
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