import { pullAll } from "../lib/slicer";
import { Subject, Observable, empty, of } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { startWith, mapTo, catchError } from "rxjs/operators";
import { TestModel } from "./fakes/testModel";
import { emptyManifest, Manifest } from "../lib/specifier";
import { pullBlocks } from "../lib/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { evaluateBlocks } from "../lib/evaluateBlocks";
import { Evaluable } from "../lib/evaluateSlices";


describe('evaluateBlocks', () => {

    const model = new TestModel();

    let blockStore: FakeBlockStore
    let manifest$: Subject<Manifest>
    let frame$: Observable<Evaluable<TestModel>>

    beforeEach(() => {
        blockStore = new FakeBlockStore();
        manifest$ = new Subject<Manifest>();

        blockStore.blocks = {
            block123: {
                myLog2: [ 1, 2, 3 ]
            }
        };

        frame$ = manifest$.pipe(
                    startWith(emptyManifest),
                    pullBlocks(blockStore),
                    evaluateBlocks(model),
                    pullAll());
    })

    it('serves single block', async () => {
        complete();

        const [frame] = await frame$.pipe(reduceToArray()).toPromise();

        const updates = await frame.load('block123')('myLog2')
                                .pipe(reduceToArray())
                                .toPromise();

        expect(updates).toEqual([1, 2, 3]);
    })

    it('returns error to caller when block not in store', async () => {
        complete();

        const [frame] = await frame$.pipe(reduceToArray()).toPromise();

        const [error] = await frame.load('block12')('myLog2')
                                    .pipe(
                                        mapTo(empty()),
                                        catchError(err => of(err)),
                                        reduceToArray())
                                    .toPromise();

        expect(error).toMatchObject(Error('Block not found!'));
    })

    it('returns empty when log not in block', async () => {
        complete();

        const [frame] = await frame$.pipe(reduceToArray()).toPromise();

        const updates = await frame.load('block123')('myLog')
                                .pipe(reduceToArray())
                                .toPromise();

        expect(updates).toEqual([]);
    })



    function complete() {
        manifest$.complete();
    }

})



