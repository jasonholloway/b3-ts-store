import { of } from "rxjs";
import { delay } from "rxjs/operators";

export function pause(ms = 10) {
    return of().pipe(delay(ms)).toPromise();
}