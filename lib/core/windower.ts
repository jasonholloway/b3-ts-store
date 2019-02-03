import { Observable, Subject } from "rxjs";
import { first, concatAll, window, skip, share } from "rxjs/operators";
import { pullAll } from "./eraSlicer";

export type Windower<V> = () => Observable<V>

export function createWindower<V>(v$: Observable<V>): Windower<V> {
    const trigger = new Subject();

    const window$ = v$.pipe(
                        window(trigger),
                        skip(1),
                        share());

    window$.subscribe();

    return () => {
        const myVal$ = window$.pipe(
                        first(),
                        concatAll(),
                        pullAll());

        trigger.next();
        return myVal$;
    }
}
