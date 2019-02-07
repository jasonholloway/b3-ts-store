import { Observable, Subject } from "rxjs";
import { concatAll, window, skip, share, take } from "rxjs/operators";
import { pullAll } from "./eraSlicer";
import { logVal } from "../utils";

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
                        take(1),                    
                        concatAll(),
                        pullAll());

        trigger.next();
        return myVal$;
    }
}
