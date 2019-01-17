import { Subject, from, OperatorFunction, pipe, Observable, empty, VirtualAction, MonoTypeOperatorFunction, of } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, reduceToDict } from "../lib/utils";
import { sliceByEra, EraSpec, Era } from "../lib/sliceByEra";
import { map, concatMap, scan, groupBy, shareReplay, mapTo, single, tap, share } from "rxjs/operators";
import { evaluate, Evaluable, Model, LogRef, KnownLogs, KnownAggr, Era$ } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, DoStore } from "../lib/committer";
import { ManifestStore, BlockStore } from "../lib/bits";
import FakeBlockStore from "./fakes/FakeBlockStore";
import FakeManifestStore from "./fakes/FakeManifestStore";

type TestRipple = Dict<number[]>

type EraCommand = void // NewEra | SuccessfulCommit


type SuccessfulCommit = {}

type NewEra = {}


function specifier(manifestStore: ManifestStore) : OperatorFunction<EraCommand, EraSpec> {
    return command$ => {
        return command$.pipe(
            scan<EraCommand, number>((ac, _) => ac + 1, -1)
        );
    }
} 



type Viewer<M extends Model> =
    <K extends KnownLogs<M>>(ref: K) => Observable<KnownAggr<M, K>>



function createViewer<M extends Model>(era$: Era$<Evaluable<M>>) : Viewer<M> {
    era$ = era$.pipe(shareReplay(1));
    era$.subscribe();

    return (ref: KnownLogs<M>) =>
        era$.pipe(
            concatMap(([_, slices]) =>
                slices.pipe(
                    concatMap(([_, {evaluate}]) => evaluate(ref))
                    ))
            );
}


//Viewing:
//each 'view' of a logref needs to itself track the latest slice seen
//it must do this by scanning
//
//


jest.setTimeout(400);

describe('viewer', () => {

    const model = new TestModel();

    let command$: Subject<EraCommand>
    let ripple$: Subject<Keyed$<number>>
    let doCommit$: Subject<DoCommit>

    let view: Viewer<TestModel>
    
    beforeEach(() => {
        const manifests = new FakeManifestStore();

        command$ = new Subject<EraCommand>();
        ripple$ = new Subject<Keyed$<number>>();
        doCommit$ = new Subject<DoCommit>();

        const era$ = command$.pipe(
                    specifier(manifests),
                    sliceByEra(ripple$),
                    evaluate(model),
                    pullAll());

        view = createViewer(era$);

        command$.next();
    })

    afterEach(() => complete())


    it('views single slice', async () => {
        ripple({ myLog: [ 1, 2 ] });

        const r = await view('myLog')
                        .pipe(reduceToArray())
                        .toPromise();
        
        expect(r).toEqual([
            '1,2'
        ]);
    })



    // async function expectViews(ref: KnownLogs<TestModel>, expected: any[]) {
    //     complete();

    //     const r = await view$.pipe(
    //                         single(),
    //                         concatMap(v => v.view(ref)),
    //                         reduceToArray())
    //                     .toPromise();

    //     expect(r).toEqual(expected);
    // }


    function ripple(rip: TestRipple) {
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