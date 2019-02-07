import { publish as publishOperator, map, publishReplay, concatMap, tap, reduce, scan, startWith, switchMap, groupBy, buffer, skipWhile, filter } from 'rxjs/operators';
import { Observable, ConnectableObservable, pipe, ObservableInput, from, OperatorFunction, empty, Subject, Subscription, MonoTypeOperatorFunction, GroupedObservable } from 'rxjs';



export type UpdateCreator<Type extends string, Body = void> 
            = ((body?: Body) => [Type, Body])
                & { readonly type: Type }
   
export function declareUpdate<Type extends string>(type: Type) {
    return {
        withData<Body>(): UpdateCreator<Type, Body> {
            return Object.assign(
                ((body: Body) => tup(type, body)),
                { type });
        }
    }
}

export type sumReturnTypes<A extends ((...args: any[]) => any), B extends ((...args: any[]) => any)> 
            = ReturnType<A> & ReturnType<B>




export type Dict<V = any> = { [key: string]: V }
            

export function propsToArray<V>(d: Dict<V>): [string, V][] {
    return Object.getOwnPropertyNames(d)
            .map(key => tup(key, d[key]));
}

export function valsToArray(obj: { [k: string]: any }) {
    return propsToArray(obj).map(([,v]) => v);
}


export function tup<T extends any[]>(...args: T): T {
    return args;
}

export function getOrSet<V, W extends V>(dict: Dict<V>, key: string, fn: () => W): W {
    return (dict[key]
        || (dict[key] = fn())) as W;
}


export const mergeDicts = <V>(mergeVals: (v0: V, v1: V) => V) => {
    const merge = ([head, ...tail]: Dict<V>[]) => {
        if(tail.length == 0) return head;
        else {
            const merged = { ...head };

            propsToArray(merge(tail))
                .forEach(([k, v]) => {
                    merged[k] = merged[k] 
                                ? mergeVals(merged[k], v)
                                : v; 
                });

            return merged;
        }
    };

    return merge;
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

export function reduceToDict<V>(): OperatorFunction<[string, V], { [key: string]: V }> {
    return reduce<[string, V], Dict<V>>((ac, [k, v]) => ({ ...ac, [k]: v }), {});
}

export function addIndex<V>() {
    return pipe(map((v: V, i) => tup(i, v)));
}

export function bufferAll<V>() : OperatorFunction<V, V[]> {
    return buffer(empty());
}


export const skipAll = 
    (): OperatorFunction<any, null> =>
        pipe(skipWhile(() => true));


export function capture<A, B>(project: (A) => Observable<B>) : OperatorFunction<A, [A, Observable<B>]> {
    return pipe(
        switchMap(a => project(a)
                        .pipe(map(b => tup(a, b)))),
        groupBy(([a, _]) => a, ([_, b]) => b),          //but as the eras accumulate, so will the groups...
        map(g => tup(g.key, g))                         //this is bobbins
    );
}


export function capture2<A, B>(project: (A) => Observable<B>) : OperatorFunction<A, [A, Observable<B>]> {
    return pipe(
        scan<A, [A, Observable<B>, Subscription]>(
            ([_, __, lastSub], a) => {
                console.log('capturing for era', a)
                const subject = new Subject<B>();
                lastSub && lastSub.unsubscribe();
                const subscription = project(a).subscribe(subject);                
                return tup(a, subject, subscription);
            }, 
            tup(null, null, null)),
        map(([a, o, _]) => tup(a, o))
    );
}


export function log<T>(inp: string | ((val: T) => string)) : MonoTypeOperatorFunction<T> {
    return tap<T>(v => console.log(typeof inp === 'string' ? inp : inp(v)));
}

export function logVal<T>(s: string) : MonoTypeOperatorFunction<T> {
    return tap(v => console.log(s, v));
}



export type Keyed$<U> = Observable<GroupedObservable<string, U>>



type ExtractEventNames<M> = M extends [infer K, any] ? K : never
type ExtractEventValues<M, K> = M extends [K, infer V] ? V : never

export const extract = 
    <A, B, M extends [A, B], K extends ExtractEventNames<M> & string, V extends ExtractEventValues<M, K>>
    (key: K) : OperatorFunction<M, V> =>
    pipe(
        filter(([k]) => k == key),
        map(([, v]) => v as V)
    );
    
