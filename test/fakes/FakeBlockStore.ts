import { Store, BlockStore, Block } from "../../lib/bits";

class FakeBlockStore implements BlockStore {

    data: any[] = [];
    errorsOnPersist = false;
    manualResponse = false;

    async load(key: string): Promise<Block> {
        if(!this.data[key]) throw Error('Block not found!');
        return this.data[key];
    }

    async save(key: string, block: Block): Promise<void> {
        if(this.data[key]) throw Error('Blocks are immutable!');
        this.data[key] = block;

        if(this.manualResponse) {
            return new Promise<void>((resolve, reject) => {
                this.resolve = resolve;
            })
        }
    }


    private resolve = () => {};

    respond() {
        this.resolve();
    }
}

export default FakeBlockStore;
