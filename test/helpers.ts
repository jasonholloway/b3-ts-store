import { toArray, last, flatMap, delay } from "rxjs/operators";
import { Observable, of, throwError, merge } from "rxjs";

export function gather<V>(v$: Observable<V>) {
    return merge(
        of(1).pipe(delay(500), flatMap(_ => throwError('TIMEOUT!'))),
        v$.pipe(toArray()),
    ).toPromise();
}

export function final<V>(v$: Observable<V>) {
    return merge(
        of(1).pipe(delay(500), flatMap(_ => throwError('TIMEOUT!'))),
        v$.pipe(last()),
    ).toPromise();
}
