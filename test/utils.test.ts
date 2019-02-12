import { of, from, empty } from "rxjs";
import { concatScan } from "../lib/utils";
import { gather } from "./helpers";


describe('utils', () => {
 
    describe('concatScan', () => {


        it('emits nothing when source is empty', async () => {
            const r = await gather(empty()
                    .pipe(concatScan(_ => of('krrrumpt'), 'wibble')));

            expect(r).toEqual([]);
        })


        it('emits nothing on projection to empty', async () => {
            const r = await gather(from([1, 2, 3])
                    .pipe(concatScan(_ => empty(), 'wibble')));

            expect(r).toEqual([]);
        })


    })    
    
})
