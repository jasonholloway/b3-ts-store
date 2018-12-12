
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
