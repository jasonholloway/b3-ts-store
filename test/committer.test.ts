import { Subject, from, OperatorFunction, pipe, Observable, GroupedObservable, MonoTypeOperatorFunction, BehaviorSubject } from "rxjs";
import { reduceToArray, Dict, Keyed$, enumerate, tup, reduceToDict } from "../lib/utils";
import { slicer, Ripple, EraWithSlices, pullAll } from "../lib/slicer";
import { map, concatMap, groupBy, tap, mergeMap, flatMap, single } from "rxjs/operators";
import { evaluate, Evaluable } from "../lib/evaluate";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, Commit } from "../lib/committer";
import { EraWithSpec, emptyManifest } from "../lib/specifier";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { serveBlocks } from "../lib/serveBlocks";
import { pause } from "./utils";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('committer', () => {

    const model = new TestModel();
    let blockStore: FakeBlockStore

    let spec$: Subject<EraWithSpec>
    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>

    let era$: Observable<EraWithSpec & EraWithSlices<Evaluable<TestModel>>>
    let commit$: Observable<Commit>

    beforeEach(() => {
        blockStore = new FakeBlockStore();

        spec$ = new Subject<EraWithSpec>();
        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();

        era$ = spec$.pipe(
                slicer(ripple$),
                serveBlocks(blockStore),
                evaluate(model),
                pullAll());

        commit$ = doCommit$.pipe(
                    committer(model, era$, null),
                    pullAllCommits());
                    
        spec$.next({ id: 0, thresh: 0, manifest: emptyManifest });
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
        spec$.complete();
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