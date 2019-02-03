import { toArray, last } from "rxjs/operators";
import { Observable } from "rxjs";
import { pullAll } from "../lib/core/eraSlicer";


export function gather<V>(v$: Observable<V>) {
    return v$.pipe(toArray(), pullAll()).toPromise();
}

export function final<V>(v$: Observable<V>) {
    return v$.pipe(last()).toPromise();
}
