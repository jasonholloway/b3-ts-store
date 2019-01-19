import { Subject, from, MonoTypeOperatorFunction } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup } from "../lib/utils";
import { slicer } from "../lib/slicer";
import { map, concatMap, groupBy, shareReplay } from "rxjs/operators";
import { evaluate, KnownLogs } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit } from "../lib/committer";
import { Viewer, createViewer } from "../lib/viewer";
import { specifier, Signal } from "../lib/specifier";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('viewer', () => {

    const model = new TestModel();

    let signal$: Subject<Signal>
    let ripple$: Subject<Keyed$<number>>
    let doCommit$: Subject<DoCommit>

    let view: Viewer<TestModel>
    
    beforeEach(() => {
        signal$ = new Subject<Signal>();
        ripple$ = new Subject<Keyed$<number>>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = signal$.pipe(
                        specifier(),
                        slicer(ripple$),
                        evaluate(model),
                        pullAll());

        view = createViewer<TestModel>(era$);

        signal$.next();
    })

    afterEach(() => complete())


    describe('single update', () => {
        it('emits view', async () => {
            emit({ myLog: [ 1 ] });
            await expectViews('myLog', [ '1' ]);
        })
    })

    describe('multiple values', () => {
        it('emits only latest view', async () => {
            emit({ myLog: [ 1, 2 ] });
            await expectViews('myLog', [ '1,2' ]);
        })
    })

    describe('across eras', () => {
        it('doesn\'t reemit if nothing changed', async () => {
            const viewing = getView('myLog');

            emit({ myLog: [ 13 ] });
            signal$.next();
            signal$.next();

            complete();

            expect(await viewing)
                .toEqual([ '13' ]);
        })
    })


    function getView(ref: KnownLogs<TestModel>) {
        return view(ref)
                .pipe(reduceToArray())
                .toPromise();
    }


    async function expectViews(ref: KnownLogs<TestModel>, expected: any[]) {
        complete();
        const r = await getView(ref);
        expect(r).toEqual(expected);
    }


    function emit(rip: TestRipple) {
        const ripple = from(enumerate(rip)).pipe(
                        concatMap(([k, r]) => from(r).pipe(map(v => tup(k, v)))),
                        groupBy(([k]) => k, ([_, v]) => v));
                    
        ripple$.next(ripple);
    }

    function complete() {
        ripple$.complete();
        signal$.complete();
        doCommit$.complete();
    }

    function pullAll<V>() : MonoTypeOperatorFunction<V> {
        return v$ => {
            v$ = v$.pipe(shareReplay());
            v$.subscribe();
            return v$;
        }
    }

})

