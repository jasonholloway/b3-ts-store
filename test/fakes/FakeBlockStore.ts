import { Block } from "../../lib/bits";
import { Observable, of, throwError, from } from "rxjs";
import { BlockStore } from "../../lib/core/BlockStore";
import { packet } from "../../lib/utils";

class FakeBlockStore implements BlockStore {

    blocks: { [key: string]: Block } = {}
    errorsOnPersist = false;
    manualResponse = false;

    load(key: string): Observable<BlockStore.LoadResponse> {
        const block = this.blocks[key];
        return block ? of(packet('Loaded', block)) : throwError('Block not found!');
    }

    save(key: string, block: Block): Observable<BlockStore.SaveResponse> {
        if(this.errorsOnPersist) {
            return throwError(Error('Failed to store block (as planned!)'));
        }

        if(this.blocks[key]) {
            return throwError(Error('AlreadyExists'));
        }

        this.blocks[key] = block;

        if(this.manualResponse) {
            return from(new Promise<BlockStore.SaveResponse>((resolve) => {
                this.resolve = (res: BlockStore.SaveResponse) => resolve(res);
            }))
        }
    }


    private resolve: (res: BlockStore.SaveResponse) => void = () => {};

    respond(response: BlockStore.SaveResponse = ['Saved', {}]) {
        this.resolve(response);
    }
}

export default FakeBlockStore;
