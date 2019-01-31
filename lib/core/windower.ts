import { Observable, Subject } from "rxjs";
import { pullAll } from "./slicer";
import { first, concatAll, window } from "rxjs/operators";

export type Windower<V> = () => Observable<V>

export function createWindower<V>(v$: Observable<V>): Windower<V> {
    const trigger = new Subject();

    const window$ = v$.pipe(window(trigger));

    return () => {
        const myVal$ = window$.pipe(
                        first(),
                        concatAll(),
                        pullAll());
        trigger.next();
        return myVal$;
    }
}
