import { BlockStore, Block } from "../../lib/bits";

class FakeBlockStore implements BlockStore {

    blocks: { [key: string]: Block } = {}
    errorsOnPersist = false;
    manualResponse = false;

    async load(key: string): Promise<Block> {
        if(!this.blocks[key]) throw Error('Block not found!');
        return this.blocks[key];
    }

    async save(key: string, block: Block): Promise<void> {
        if(this.blocks[key]) throw Error('Blocks are immutable!');
        this.blocks[key] = block;

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
