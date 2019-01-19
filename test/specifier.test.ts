import { Subject, OperatorFunction, of, forkJoin, pipe } from "rxjs";
import { reduceToArray, tup } from "../lib/utils";
import { EraWithThresh, pullAll } from "../lib/slicer";
import { mapTo, delay, startWith, tap, scan } from "rxjs/operators";
import { Signal, newEra } from "../lib/specifier";

jest.setTimeout(400);



function specifier() : OperatorFunction<Signal, EraWithThresh> {
    return pipe(
        scan((prev: EraWithThresh, signal: Signal) => 
            ({ id: prev.id + 1, thresh: 0 }),
            { id: -1, thresh: 0 })
    );
}

describe('specifier', () => {

    let perform: () => Promise<void>
    let signal$: Subject<Signal>
    let eras: EraWithThresh[];

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
            { id: 0, thresh: 0 }
        ]))


    describe('newEra signal', () => {
        beforeAll(() => {
            perform = async () => {
                signal$.next(newEra());
                signal$.next(newEra());
                await pause();
            }
        })

        it('triggers new era', () => 
            expect(eras).toEqual([
                { id: 0, thresh: 0 }, 
                { id: 1, thresh: 0 }, 
                { id: 2, thresh: 0 },
            ]))
    })




    async function complete() {
        await pause();
        signal$.complete();
    }

})

function pause() {
    return of().pipe(delay(10)).toPromise();
}