import { Observable, Subject, from, empty } from "rxjs";
import { Dict, scanToArray, enumerate, reduceToArray, tup, reduceToDict, switchHere } from "../lib/utils";
import { map, flatMap, groupBy, startWith, scan, concatAll } from "rxjs/operators";

type UpdateMap<U> = Dict$<Observable<U>>
type Command = 'reset' | { commitId: number }
type EraRef = number

type Dict$<V> = Observable<[string, V]>
type SliceEra<U> = [EraRef, Dict$<Observable<U>>]

function manageSlices<U>(commands: Observable<Command>, slices: Observable<UpdateMap<U>>): Observable<SliceEra<U>> {
    //eras are currently triggered by all input commands
    const eras = commands.pipe(
        startWith(0), 
        scan(ac => ac + 1, 0)
    );

    //!!!!!!!!
    const numberedSlices = slices.pipe(map((sl, i) => tup(i, sl)));
    //!!!!!!!!

    return eras.pipe(
        switchHere(slices.pipe(startWith(empty()))),
        map(([era, partsPerSlice]) => tup(era, partsPerSlice.pipe(    
            concatAll(),
            groupBy(([logRef, _]) => logRef, ([_, updates]) => updates),
            map(g => tup(g.key, g.pipe(concatAll())))
        )))
    );
}



describe('manageSlices', () => {

    let slices: Subject<UpdateMap<number>>
    let commands: Subject<Command>
    let gathering: Promise<Dict<number[]>[]>

    beforeEach(() => {
        commands = new Subject<Command>();
        slices = new Subject<UpdateMap<number>>();
        gathering = manageSlices(commands, slices)
                    .pipe(
                        flatMap(([era, parts]) => parts.pipe(
                            flatMap(([logRef, updates]) => updates.pipe(reduceToArray(), map(r => tup(logRef, r))) ),
                            reduceToDict()
                        )),
                        scanToArray()
                    )
                    .toPromise();
    })


    it('single slice appears in output', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        
        const r = await complete();
        expect(r).toEqual([
            { log1: [ 1, 2, 3 ] }
        ])                
    })

    it('multiple slices appears in output', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        slice({ log2: [ 4, 5, 6 ] });

        const r = await complete();
        expect(r).toEqual([
            { log1: [ 1, 2, 3 ], log2: [ 4, 5, 6] }
        ])                
    })

    it('updates of same log are concatenated', async () => {
        slice({ log1: [ 1, 2, 3 ], log2: [ 1 ] });
        slice({ log1: [ 4, 5, 6 ], log2: [ 2 ] });

        const r = await complete();
        expect(r).toEqual([
            { log1: [ 1, 2, 3, 4, 5, 6], log2: [ 1, 2 ] }
        ])                
    })

    it('on reset, starts new era', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        reset();
        
        const r = await complete();
        expect(r).toEqual([
            { log1: [ 1, 2, 3 ] },
            {}
        ])
    })


    it('new era emits new slices', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        reset();
        slice({ log1: [ 4 ] });
        
        const r = await complete();
        expect(r).toEqual([
            { log1: [ 1, 2, 3 ] },
            { log1: [ 4 ] }
        ])
    })



    //*******************
    //NB we must commit using SliceRef! Not with EraRef!
    //eras are created after commits... commits are specified using slices...

    it('confirmCommit starts new era', async () => {
        slice({ log1: [ 1, 2, 3 ] });
        sliceCommitted(3);
        slice({ log1: [ 4 ] });
        
        const r = await complete();
        expect(r).toEqual([
            { log1: [ 1, 2, 3 ] },
            { log1: [ 4 ] }
        ])
    })

    //*******************
    //NB make sure Slices are completed before committing!
    //they have to be immutable, final
    //
    //plus there can't be any errors before committing
    //








    function complete() {
        commands.complete();
        slices.complete();
        return gathering;
    }

    
    function reset() {
        commands.next('reset');
    }

    function sliceCommitted(sliceId: number) {

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