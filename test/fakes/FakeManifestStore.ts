import { ManifestStore, Manifest } from "../../lib/bits";

class FakeManifestStore implements ManifestStore {

    saved: Manifest = { version: 0, logs: {} }

    async load(): Promise<Manifest> {
        return this.saved;
    }    
    
    async save(manifest: Manifest): Promise<void> {
        this.saved = manifest;
    }

}

export default FakeManifestStore;
