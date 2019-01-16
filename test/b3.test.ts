import { Map } from 'immutable'
import { declareUpdate } from '../lib/utils';
import { declareLogModel } from '../lib/bits';


describe('b3 model', () => {
    it('blah', () => {
        
    })
})



type Id = number

type Product = {
    id: Id,
    name: String
}

const putProduct = declareUpdate('PutProduct')
                        .withData<{
                            id: Id,
                            name: String
                        }>();

const dropProduct = declareUpdate('DropProduct')
                        .withData<{
                            id: Id
                        }>();

type B3Update =   ReturnType<typeof putProduct>
                | ReturnType<typeof dropProduct>
              

type B3Data = Map<String, Map<Id, Product>>



const b3Model = declareLogModel({

    zero: Map({
        products: Map<Id, Product>()
    }),

    add(data: B3Data, [_, type, body]: B3Update): B3Data {        
        switch(type) {
            case 'PutProduct':
                return data.update('products', 
                            ps => ps.update(body.id, p => p))

            default:
                throw Error('Strange update!');
        }
    },

    // view(data: B3Data) {
    //     return {
    //         products: data.get('products'),
    //         taxonomy: null
    //     }
    // }
})
