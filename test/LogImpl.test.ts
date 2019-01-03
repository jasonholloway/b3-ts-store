import { createLog } from "../lib/Log";
import { testModel, addUp } from "./fakes/testModel";
import { ReplaySubject, from, Subject, forkJoin } from "rxjs";
import { LogSpec } from "../lib/LogSpace";
import { reduce, last, delay, finalize, combineAll } from "rxjs/operators";

describe('LogImpl', () => {

    jest.setTimeout(500);

    let x: ReturnType<typeof createFixture>

    beforeEach(() => {
        x = createFixture();
    })

    it('emits view on spec, via block-loading and aggregation', async () => {
        x.spec({ head: 0, blocks: [ '1:2:3' ] });

        const { views } = await x.complete();
        expect(views).toEqual(['1:2:3']);
    })

    it('emits new view on new spec', async () => {
        x.spec({ head: 0, blocks: [ '1:2' ] });
        x.spec({ head: 0, blocks: [ '1:2', '3:4:5' ] });

        const { views } = await x.complete(); 
        expect(views).toEqual(['1:2', '1:2:3:4:5']);
    })

    it('updates well-ordered when blocks load inconsistently', async () => {
        x.spec({ head: 0, blocks: [ '1:2;delay=300', '3:4:5' ] });

        const { views } = await x.complete(); 
        expect(views).toEqual(['1:2:3:4:5']);
    })

    it('loads blocks concurrently', async () => {
        x.spec({ head: 0, blocks: [ '1:2;delay=100', '3:4:5;delay=100' ] });

        const { maxConcurrentLoads } = await x.complete();
        expect(maxConcurrentLoads).toBeGreaterThan(1);
    })

})



function createFixture() {
    const specs = new ReplaySubject<LogSpec>();
    const updates = new ReplaySubject<string>();
    const loads = new Subject<number>();

    const log = createLog('KEY', testModel, specs, loadBlock);

    const allViews = log.views
                        .pipe(gatherInArray(), last());

    const maxLoads = loads
                        .pipe(reduce((ac, v) => ac + v, 0));

    const gatheringStats = forkJoin(allViews, maxLoads).toPromise();

    return {
        spec: (s: LogSpec) => specs.next(s),
        update: (u: string) => updates.next(u),

        async complete() {
            specs.complete();
            updates.complete();
            loads.complete();

            const [views, maxConcurrentLoads] = await gatheringStats;

            return {
                views,
                maxConcurrentLoads
            }
        }
    }

    function loadBlock(ref: string) {
        loads.next(1);

        let specs = [];
        let delayMs = 0;
        let result: RegExpExecArray;

        const refRegex = /((?:^[0-9:]*)|(?:delay=\d+))(?:;|$)/g;

        while(result = refRegex.exec(ref)) {
            if(result.index == 0) {                
                specs = result[1].split(':');
            }
            else {
                const [ option, value ] = result[1].split('=');
                switch(option) {
                    case 'delay':
                        delayMs = parseInt(value);
                        break;
                }
            }
        }

        return from(specs.map(n => addUp(0, `${n}`)))
                .pipe(delay(delayMs))
                .pipe(finalize(() => loads.next(-1)))   
    }
}


function gatherInArray<V>() {
    return reduce<V, V[]>((ac, v) => [...ac, v], []);
}

