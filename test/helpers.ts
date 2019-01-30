import { toArray, last } from "rxjs/operators";
import { Observable } from "rxjs";


export function gather<V>(v$: Observable<V>) {
    return v$.pipe(toArray()).toPromise();
}

export function final<V>(v$: Observable<V>) {
    return v$.pipe(last()).toPromise();
}