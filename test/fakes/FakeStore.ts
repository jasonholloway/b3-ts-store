import { Store } from "../../lib/bits";

export class FakeStore<U> implements Store<U> {

    data: U[] = [];
    errorsOnPersist = false;
    manualResponse = false;

    async readAll(name: string): Promise<U[]> {
        return this.data;
    }

    private responding;

    async persist(name: string, batch: U[]): Promise<void> {
        if(this.errorsOnPersist) {
            throw Error('ErrorsOnPersist');
        }

        this.data.push(...batch);

        if(this.manualResponse) {

            //!!!!!!!!!

            this.responding = new Promise((resolve, reject) => {

            })
        }
    }

    respond() {
        this.responding.resolve();
    }
}
