
export type UpdateCreator<Type extends string, Props = void> 
            = ((props?: Props) => Readonly<{ type: Type } & Props>)
                & { readonly type: Type }
   

export function declareUpdate<Type extends string>(type: Type) {
    return {
        withData<Props extends object>(): UpdateCreator<Type, Props> {
            return Object.assign(
                ((props: Props) => Object.assign({}, props, { type })),
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
