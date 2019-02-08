import { Manifest } from "../../lib/core/signals";
import { Observable, empty, of } from "rxjs";
import { ManifestStore } from "../../lib/core/ManifestStore";
import { tup, packet } from "../../lib/utils";

class FakeManifestStore implements ManifestStore {

    manifest: Manifest = undefined;

    load(): Observable<ManifestStore.LoadEvent> {
        return this.manifest 
                ? of(packet('Loaded', this.manifest))
                : empty();
    }    
    
    save(newManifest: Manifest): Observable<ManifestStore.SaveEvent> {
        if(newManifest.version <= ((this.manifest && this.manifest.version) || 0))
            return of(packet('Gazumped'));
        else {
            this.manifest = newManifest;
            return of(packet('Saved'));
        }
    }

}

export default FakeManifestStore;
