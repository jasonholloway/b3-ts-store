import { Observable, Subject } from "rxjs";
import { concatAll, window, skip, shareReplay, take } from "rxjs/operators";
import { pullAll } from "./eraSlicer";

export type Windower<V> = () => Observable<V>

export function createWindower<V>(v$: Observable<V>): Windower<V> {
    const trigger = new Subject();

    const window$ = v$.pipe(
                        window(trigger),
                        shareReplay(1));

    window$.subscribe();

    return () => {
        const myVal$ = window$.pipe(
                        skip(1),
                        take(1),
                        concatAll(),                        
                        pullAll());
        
        trigger.next();
        return myVal$;
    }
}
