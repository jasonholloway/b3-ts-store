import { ManifestStore } from "../../lib/bits";
import { Manifest } from "../../lib/specifier";
import { Observable, empty, of, throwError } from "rxjs";

class FakeManifestStore implements ManifestStore {

    manifest: Manifest = undefined;

    load(): Observable<Manifest> {
        return this.manifest ? of(this.manifest) : empty();
    }    
    
    save(newManifest: Manifest): Observable<void> {
        if(newManifest.version <= ((this.manifest && this.manifest.version) || 0))
            return throwError('Newer manifest in place!');
        else {
            this.manifest = newManifest;
            return empty();
        }
    }

}

export default FakeManifestStore;
