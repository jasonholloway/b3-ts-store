import { Observer, OperatorFunction, pipe } from "rxjs";
import { map } from "rxjs/operators";

export interface EraWithErrors {
    errors?: Observer<Error>
}

export const sinkErrors =
    <I extends object, O extends EraWithErrors & I>
    (sink: Observer<Error>) : OperatorFunction<I, O> =>
        pipe(
            map(era => ({
                ...era as object,
                errors: sink
            } as O))
        );
