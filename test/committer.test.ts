import { Subject, from, pipe, Observable, GroupedObservable, MonoTypeOperatorFunction, BehaviorSubject } from "rxjs";
import { reduceToArray, Dict, enumerate, tup, log } from "../lib/utils";
import { slicer, Ripple, EraWithSlices, pullAll } from "../lib/slicer";
import { map, concatMap, groupBy, startWith } from "rxjs/operators";
import { evaluateSlices, Evaluable } from "../lib/evaluateSlices";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, Commit } from "../lib/committer";
import { emptyManifest, specifier, Epoch } from "../lib/specifier";
import { pause } from "./utils";
import { newEpoch } from "../lib/createStore";
import { emptyBlocks } from "../lib/pullBlocks";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('committer', () => {

    const model = new TestModel();

    let epoch$: Subject<Epoch>
    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>

    let era$: Observable<EraWithSlices<Evaluable<TestModel>>>
    let commit$: Observable<Commit>

    beforeEach(() => {
        epoch$ = new Subject<Epoch>();
        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();

        era$ = epoch$.pipe(
                startWith(newEpoch(emptyManifest, emptyBlocks)),
                specifier(),
                slicer(ripple$),
                evaluateSlices(model),
                pullAll());

        commit$ = doCommit$.pipe(
                    committer(model, era$, null),
                    pullAllCommits());
    })

    afterEach(complete)


    it('stores first slice', async () => {
        emit({ a: [ 1, 2 ] });
        emit({ b: [ 1 ] });
        doCommit();

        await expectCommits([{
            data: { a: [ 1, 2 ] },
            extent: 1
        }]);
    })

    it('does nothing if no slices', async () => {
        doCommit();

        await expectCommits([]);
    })

    it('does nothing if slice incomplete', async () => {
        const listener = new BehaviorSubject<Commit>(null);
        commit$.subscribe(listener);

        const incompleteRipple = new Subject<[string, GroupedObservable<string, number>]>();
        ripple$.next(incompleteRipple);
        doCommit();

        await pause();
        expect(listener.value).toBeNull();
    })

    xit('only commits if slice known good', async () => {
        throw 12345;
    })



    function emit(rip: TestRipple) {
        const ripple = from(enumerate(rip)).pipe(
                        concatMap(([k, r]) => from(r).pipe(map(v => tup(k, v)))),
                        groupBy(([k]) => k, ([_, v]) => v),
                        map(g => tup(g.key, g)));
                    
        ripple$.next(ripple);
    }

    function doCommit() {
        doCommit$.next();
    }


    async function expectCommits(commits: { data: Dict<number[]>, extent: number }[]) {
        complete();

        const r = await commit$
                        .pipe(reduceToArray())
                        .toPromise();

        expect(r).toMatchObject(commits);
    }

    function complete() {
        ripple$.complete();
        epoch$.complete();
        doCommit$.complete();
    }


    function pullAllCommits() : MonoTypeOperatorFunction<Commit> {
        return pipe(
            map(commit => ({ 
                ...commit ,
                errors: commit.errors.pipe(pullAll())
            })),
            pullAll())
    }


})