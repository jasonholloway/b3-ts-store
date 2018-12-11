import { Map } from 'immutable'

type Id = number

type Product = {}




const putProduct = createEvent('PutProduct')
                    .withData<{
                        id: Id,
                        name: String
                    }>();

const dropProduct = createEvent('DropProduct')
                    .withData<{
                        id: Id
                    }>();


type B3Update =   ReturnType<typeof putProduct>
                | ReturnType<typeof dropProduct>
              

type B3Data = Map<String, Map<Id, Product>>



class B3Model implements Model<B3Update, B3Data> {
    
    zero = Map({
        products: Map<Id, Product>()
    });

    add(data: B3Data, up: B3Update): B3Data {        
        switch(up.type) {
            case 'PutProduct':
                return data.update('products', 
                            ps => ps.update(up.id, p => p))

            default:
                throw Error('Strange update!');
        }
    }
}



describe('Store', () => {

    const committer = (ups: Update[]) => Promise.resolve();
    const store = createStore(new B3Model(), committer);

    beforeAll(() => {})


})




type Update = {
    type: String
}

type Data = {}

type Model<U extends Update, D extends Data> = {
    zero: D,
    add(d: D, up: U): D
}




type Committer = (ups: Update[]) => Promise<void>

function createStore<M extends Model<U, D>, U extends Update, D extends Data>(model: M, committer: Committer) {

    let data = model.zero;

    return {
        data() { 
            return data;
        },
        stage(up: U) {

            /*
            model should also vet updates of course
            
            */

            data = model.add(data, up);
        },
        commit(): Promise<void> {
            return Promise.resolve();
        }
    };
}





export type EventCreator<Type extends string, Props = void> 
            = ((props?: Props) => Readonly<{ type: Type } & Props>)
                & { readonly type: Type }
               

export function createEvent<Type extends string>(type: Type) {
    return {
        withData<Props extends object>(): EventCreator<Type, Props> {
            return Object.assign(
                ((props: Props) => Object.assign({}, props, { type })),
                { type });
        }
    }
}

export type sumReturnTypes<A extends ((...args: any[]) => any), B extends ((...args: any[]) => any)> 
            = ReturnType<A> & ReturnType<B>