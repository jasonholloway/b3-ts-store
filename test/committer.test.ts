import { Subject, from, pipe, Observable, GroupedObservable, MonoTypeOperatorFunction, BehaviorSubject, zip, empty } from "rxjs";
import { reduceToArray, Dict, propsToArray, tup } from "../lib/utils";
import { map, concatMap, groupBy, startWith } from "rxjs/operators";
import { TestModel } from "./fakes/testModel";
import { DoCommit, committer, Commit } from "../lib/core/committer";
import { emptyManifest, NewEpoch, Manifest } from "../lib/core/signals";
import { pause } from "./utils";
import { newEpoch } from "../lib/core";
import { evaluator, EvaluableEra } from "../lib/core/evaluator";
import { KnownLogs } from "../lib/core/evaluable";
import { Ripple, pullAll, eraSlicer } from "../lib/core/eraSlicer";
import { createWindower } from "../lib/core/windower";
import { pullBlocks } from "../lib/core/pullBlocks";
import FakeBlockStore from "./fakes/FakeBlockStore";
import { evaluateBlocks } from "../lib/core/evaluateBlocks";

type TestRipple = Dict<number[]>

jest.setTimeout(400);

describe('committer', () => {

    const model = new TestModel();

    let manifest$: Subject<Manifest>
    let ripple$: Subject<Ripple<number>>
    let doCommit$: Subject<DoCommit>

    let era$: Observable<EvaluableEra<TestModel>>
    let commit$: Observable<Commit>

    beforeEach(() => {
        manifest$ = new BehaviorSubject(emptyManifest);
        ripple$ = new Subject<Ripple<number>>();
        doCommit$ = new Subject<DoCommit>();

        const epoch$ = zip(
                        manifest$,
                        manifest$.pipe(
                            pullBlocks(new FakeBlockStore()),
                            evaluateBlocks(model)));

        era$ = epoch$.pipe(
                eraSlicer(empty(), ripple$),
                evaluator(model),
                pullAll());

        commit$ = doCommit$.pipe(
                    committer(era$, null),
                    pullAllCommits());
    })

    afterEach(complete)


    it('stores all slices of era', async () => {
        emit({ a: [ 1, 2 ] });
        emit({ b: [ 4 ] });
        emit({ a: [ 3 ] });
        doCommit();

        await expectCommits([{
            data: { 
                a: [ 1, 2, 3 ],
                b: [ 4 ]
            },
            // extent: 2
        }]);
    })

    it('does nothing if no slices', async () => {
        doCommit();

        await expectCommits([]);
    })

    it('does nothing if no updates', async () => {
        emit({});
        emit({ a: [] });
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
        const ripple = from(propsToArray(rip)).pipe(
                        concatMap(([k, r]) => from(r).pipe(map(v => tup(k, v)))),
                        groupBy(([k]) => k, ([_, v]) => v),
                        map(g => tup(g.key, g)));
                    
        ripple$.next(ripple);
    }

    function doCommit() {
        doCommit$.next();
    }


    async function expectCommits(commits: { data: Dict<number[]>, extent?: number }[]) {
        complete();

        const r = await commit$
                        .pipe(map(({data, extent}) => ({ data, extent })))
                        .pipe(reduceToArray())
                        .toPromise();

        expect(r).toMatchObject(commits);
    }

    function complete() {
        manifest$.complete();
        ripple$.complete();
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