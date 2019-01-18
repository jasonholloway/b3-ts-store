import { Subject, from, OperatorFunction, MonoTypeOperatorFunction } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup } from "../lib/utils";
import { slicer, EraWithThresh } from "../lib/slicer";
import { map, concatMap, groupBy, shareReplay, mapTo } from "rxjs/operators";
import { evaluate, KnownLogs } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit } from "../lib/committer";
import { Viewer, createViewer } from "../lib/viewer";

type TestRipple = Dict<number[]>

type EraCommand = void // NewEra | SuccessfulCommit

jest.setTimeout(400);

describe('viewer', () => {

    const model = new TestModel();

    let command$: Subject<EraCommand>
    let ripple$: Subject<Keyed$<number>>
    let doCommit$: Subject<DoCommit>

    let view: Viewer<TestModel>
    
    beforeEach(() => {
        command$ = new Subject<EraCommand>();
        ripple$ = new Subject<Keyed$<number>>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = command$.pipe(
                        specifier(),
                        slicer(ripple$),
                        evaluate(model),
                        pullAll());

        view = createViewer(era$);

        command$.next();
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
            command$.next();
            command$.next();

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
        command$.complete();
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


function specifier() : OperatorFunction<EraCommand, EraWithThresh> {
    return command$ => {
        return command$.pipe(
            mapTo({ thresh: 0 })
            //scan<EraCommand, number>((ac, _) => ac + 1, -1)
        );
    }
} 
