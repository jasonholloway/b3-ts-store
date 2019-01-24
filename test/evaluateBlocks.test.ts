import { pullAll } from "../lib/core/slicer";
import { Subject, Observable, empty, of } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { startWith, mapTo, catchError, last, toArray } from "rxjs/operators";
import { TestModel } from "./fakes/testModel";
import { Manifest } from "../lib/core/specifier";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";
import { Evaluable } from "../lib/core/evaluateSlices";


describe('evaluateBlocks', () => {

    const model = new TestModel();

    let blockStore: FakeBlockStore
    let manifest$: Subject<Manifest>
    let frame$: Observable<Evaluable<TestModel>>
    let manifest: Manifest;

    beforeEach(() => {
        blockStore = new FakeBlockStore();
        manifest$ = new Subject<Manifest>();

        blockStore.blocks = {
            block1: {
                myLog: [ 1, 2 ]
            },
            block2: {
                myLog: [ 3, 4 ]
            },
            block3: {
                myLog: [ 5 ],
                myLog2: [ 1, 2, 3 ]
            }
        };

        manifest = { 
            version: 1, 
            logBlocks: { 
                myLog: [ 'block1', 'block2', 'block3' ],
                myLog2: [ 'block3' ],
                myLog3: [ 'block1' ],
                myLog4: [ 'wibble' ]
            } 
        };

        frame$ = manifest$.pipe(
                    startWith(manifest),
                    pullBlocks(blockStore),
                    evaluateBlocks(model),
                    pullAll());
    })

    describe('simple', () => {
        beforeEach(complete);

        it('evaluates single block', async () => {
            const frame = await final(frame$);
            const view = await final(frame.evaluate('myLog2'));

            expect(view).toEqual('1,2,3');
        })

        it('evaluates multiple block', async () => {
            const frame = await final(frame$);
            const view = await final(frame.evaluate('myLog'));

            expect(view).toEqual('1,2,3,4,5');
        })

        it('returns empty if log unknown in blocks', async () => {
            const frame = await final(frame$);
            const views = await gather(frame.evaluate('myLog3'));

            expect(views).toEqual([]);
        })

        it('throws error if block not known', async () => {
            const frame = await final(frame$);
            
            await expect(gather(frame.evaluate('myLog4')))
                    .rejects.toThrowError('Block not found!');
        })
    })


    describe('after update', () => {
        beforeEach(() => {
            blockStore.blocks.block4 = { myLog: [ 10 ], myLog2: [ 4, 5, 6] }
            manifest$.next({ 
                version: 2, 
                logBlocks: {
                    myLog: [ 'block4' ],
                    myLog2: [ 'block3', 'block4' ]
                }
            });

            complete();
        })

        it('evaluates new blocks', async () => {
            const frame = await final(frame$);
            const view = await final(frame.evaluate('myLog2'));

            expect(view).toEqual('1,2,3,4,5,6');
        })

        it('forgets previous blocks', async () => {
            const frame = await final(frame$);
            const view = await final(frame.evaluate('myLog'));

            expect(view).toEqual('10');
        })
    })


    function complete() {
        manifest$.complete();
    }

    function gather<V>(v$: Observable<V>) {
        return v$.pipe(toArray()).toPromise();
    }

    function final<V>(v$: Observable<V>) {
        return v$.pipe(last()).toPromise();
    }

})



