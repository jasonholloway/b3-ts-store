import { toArray, last, timeout } from "rxjs/operators";
import { Observable } from "rxjs";

export function gather<V>(v$: Observable<V>) {
    return v$.pipe(
        toArray(),
        timeout(500),
    ).toPromise();
}

export function final<V>(v$: Observable<V>) {
    return v$.pipe(
        last(),
        timeout(500)
    ).toPromise();
}
