import { Observable, Subject, from, empty, of, OperatorFunction, ReplaySubject } from "rxjs";
import { Dict, scanToArray, enumerate, reduceToArray, tup, reduceToDict, addIndex, bufferAll } from "../lib/utils";
import { map, startWith, scan, concatMap, window, withLatestFrom, filter, share, concat, shareReplay, tap, publishReplay, flatMap, exhaustMap, mergeAll, buffer } from "rxjs/operators";

type SliceRef = number;
type Slice<V> = [SliceRef, V]
type Slice$<V> = Observable<Slice<V>>

type EraRef = number
type Era<V> = [EraRef, Slice$<V>]



type Dict$<V> = Observable<[string, V]>
type LogPart$<U> = Dict$<Observable<U>>

function manageSlices<V>(cursors: Observable<number>, slices: Observable<V>): Observable<Era<V>> {

    cursors = cursors.pipe(share());    //this is shared as single subject to ensure ordering of subscriptions (needed for below)

    return slices.pipe(addIndex())
            .pipe(
                window(cursors),

                withLatestFrom(cursors.pipe(startWith(-1))),

                scan(([_, prev]: [Slice$<V>, Observable<Slice<V>[]>], [curr, cursor]: [Slice$<V>, number]) => {
                        const era = prev.pipe(
                                        mergeAll(),
                                        concat(curr),
                                        filter(([id, _]) => id > cursor)
                                    );
                        
                        return tup(era, era.pipe(bufferAll()));     //eagerly materializes for future use
                    },                                              //BUT!!! needs to be subscribed to, dunnit! *****************
                    tup(empty(), of([]))),

                map(([o, _]) => o),

                addIndex()
            );

    //***
    //all slices must be complete before a new one is admitted...
    //but how can we ensure this?
    //
    //otherwise it'd be possible to add to a slice from a previous era
    //but maybe this is in fact ok
    //what we can't have is *committing* an uncompleted slice
    //even resetting such a slice would be fine: the publisher to the slice will be emitting into space
    //
    //as long as all slices up to the point of committing are complete, all is ok
    //******
}



describe('manageSlices', () => {

    let slices: Subject<LogPart$<number>>
    let cursors: Subject<number>
    let gathering: Promise<[EraRef, [SliceRef, Dict<number[]>][]][]>

    beforeEach(() => {
        cursors = new Subject<number>();
        slices = new Subject<LogPart$<number>>();
        gathering = manageSlices(cursors, slices)
                    .pipe(
                        concatMap(([era, slices]) => slices.pipe(
                            concatMap(([ref, parts]) => parts.pipe(
                                concatMap(([logRef, updates]) => updates.pipe(                                                                                                                            
                                                                    reduceToArray(),
                                                                    map(r => tup(logRef, r)))),
                                reduceToDict(),
                                map(u => tup(ref, u)))),
                            reduceToArray(),
                            map(r => tup(era, r)))),
                        scanToArray())
                    .toPromise();
    })

    it('single slice appears in output', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        
        await expectEras([
            [0, [
                [0, { log1: [ 1, 2, 3 ] }]
            ]]
        ])                
    })

    it('multiple slices appears in output', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        slice({ log2: [ 4, 5, 6 ] });

        await expectEras([
            [0, [
                [0, { log1: [ 1, 2, 3 ] }],
                [1, { log2: [ 4, 5, 6 ] }]
            ]]
        ])                
    })


    //capture() doesn't work as we want: a new era is only published
    //when the first slice comes through to be captured
    //whereas we want the new group to be eagerly pushed through
    //


    it('on reset, starts new era', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        moveCursor(0);

        await expectEras([
            [0, [
                [0, { log1: [ 1, 2, 3 ] }]
            ]],
            [1, []]
        ])
    })


    it('new era emits new slices', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        moveCursor(0);
        slice({ log1: [ 4 ] });
        
        await expectEras([
            [0, [
                [0, { log1: [ 1, 2, 3 ] }]
            ]],
            [1, [
                [1, { log1: [ 4 ] }]
            ]]
        ])
    })


    describe('confirmCommit', () => {

        it('starts new era', async () => {
            slice({ log1: [ 1, 2, 3 ] });
            moveCursor(0);
            slice({ log1: [ 4 ] });
            
            await expectEras([
                [0, [
                    [0, { log1: [ 1, 2, 3] }]
                ]],
                [1, [
                    [1, { log1: [ 4 ] }]
                ]]
            ])
        })

        it('uncommitted slices live on', async () => {
            slice({ log1: [ 1 ] });
            slice({ log1: [ 2 ] });
            slice({ log1: [ 3 ] })
            moveCursor(1);
            
            await expectEras([
                [0, [
                    [0, { log1: [ 1 ] }],
                    [1, { log1: [ 2 ] }],
                    [2, { log1: [ 3 ] }]
                ]],
                [1, [
                    [2, { log1: [ 3 ] }]
                ]]
            ])
        })
    
    })


    //*******************
    //NB make sure Slices are completed before committing!
    //they have to be immutable, final
    //
    //plus there can't be any errors before committing
    //




    async function expectEras(expected: [EraRef, [SliceRef, Dict<number[]>][]][]) {
        const r = await complete();
        expect(r).toEqual(expected);
    }




    function complete() {
        cursors.complete();
        slices.complete();
        return gathering;
    }

    function moveCursor(n: number) {
        cursors.next(n);
    }
    
    function slice(sl: Dict<number[]>) {
        slices.next(
            from(enumerate(sl))
                .pipe(map(([k, r]) => tup(k, from(r))))
        );
    }


    //the reduction above is fresh on each UpdateMap
    //so the previous reduceToArray... hmm
    //so each time a new UpdateMap frame comes through,
    //the seemingly-fresh observables are reduced afresh:
    //but, because the new reduction operator is only subscribed at the later time,
    //the previous emittances have been missed
    //
    //we could rectify this by using ReplaySubjects so that each and every later subscriber sees a full depth of history
    //but there's an inefficiency in this that it'd be nice to localise later
    //instead of publishing frames, then, that must each time re-state the already-in-play
    //GroupedObservables would fit the bill:
    //they are only emitted once

    //but what then of resetting? for this we do indeed require frames... but in their right place: let's leave this consideration for now

})