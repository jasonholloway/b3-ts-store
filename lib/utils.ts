import { publish as publishOperator, map, publishReplay, concatMap, flatMap, tap, reduce, scan, startWith } from 'rxjs/operators';
import { Observable, ConnectableObservable, pipe, ObservableInput, from, OperatorFunction } from 'rxjs';


export type UpdateCreator<Type extends string, Body = void> 
            = ((version: number, body?: Body) => [number, Type, Body])
                & { readonly type: Type }
   
export function declareUpdate<Type extends string>(type: Type) {
    return {
        withData<Body>(): UpdateCreator<Type, Body> {
            return Object.assign(
                ((version: number, body: Body) => tup(version, type, body)),
                { type });
        }
    }
}

export type sumReturnTypes<A extends ((...args: any[]) => any), B extends ((...args: any[]) => any)> 
            = ReturnType<A> & ReturnType<B>




export type Dict<V> = { [key: string]: V }
            

export function enumerate<V>(d: Dict<V>): [string, V][] {
    return Object.getOwnPropertyNames(d)
            .map(key => tup(key, d[key]));
}

export function tup<T extends any[]>(...args: T): T {
    return args;
}

export function getOrSet<V, W extends V>(dict: Dict<V>, key: string, fn: () => W): W {
    return (dict[key]
        || (dict[key] = fn())) as W;
}



export function publish<T>(source: Observable<T>): ConnectableObservable<T> {
  return publishOperator<T>()(source);
}


export function concatMapEager<A, B>(project: (a: A) => ObservableInput<B>) : OperatorFunction<A, B> {
    return pipe(
            map(a => from(project(a))),
            map(o => o.pipe(publishReplay())),
            tap(o => (o as ConnectableObservable<B>).connect()),
            concatMap(o => o)
        );
}



export function scanToArray<V>() {
    return pipe(
        scan<V, V[]>((ac, v) => [...ac, v], []),
        startWith([] as V[]),
        );
}


export function reduceToArray<V>() {
    return reduce<V, V[]>((ac, v) => [...ac, v], []);
}

