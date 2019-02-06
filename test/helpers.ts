import { toArray, last, timeout } from "rxjs/operators";
import { Observable } from "rxjs";

export function gather<V>(v$: Observable<V>) {
    return v$.pipe(toArray(), timeout(1000)).toPromise();
}

export function final<V>(v$: Observable<V>) {
    return v$.pipe(last(), timeout(1000)).toPromise();
}
