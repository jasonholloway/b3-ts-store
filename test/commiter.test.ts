import { Subject, Observable, empty, from, ObservableInput } from "rxjs";
import { reduceToArray } from "../lib/utils";
import { Era } from "../lib/slice";

type DoStore<V> = {
    vals: V[],
    range: [number, number]
}

function committer<V>() {

    //...

    return {
        doStore$: empty() as Observable<DoStore<V>>
    };
}


describe('committer', () => {

    let era$: Subject<Era<number>>
    let doCommit$: Subject<void>
    let gathering: Promise<DoStore<number>[]>

    beforeEach(() => {
        era$ = new Subject<Era<number>>();
        doCommit$ = new Subject<void>();

        gathering = committer<number>()
                    .doStore$
                    .pipe(reduceToArray())
                    .toPromise();
    })



    it('committing sends doStore', async () => {
        era([ 
            [2, 12],
            [3, 13],
            [4, 14]
        ]);
        doCommit();

        await expectStore({
            vals: [12, 13, 14],
            range: [2, 4]
        });
    })



    function era(era: ObservableInput<[number, number]>) {
        era$.next(from(era));
    }

    function doCommit() {
        doCommit$.next();
    }


    async function expectStore(doStore: DoStore<number>) {
        const r = await complete();
        expect(r).toEqual([ doStore ]);
    }

    function complete() {
        era$.complete();
        doCommit$.complete();
        return gathering;
    }

})