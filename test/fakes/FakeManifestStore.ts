import { Manifest } from "../../lib/core/signals";
import { Observable, empty, of } from "rxjs";
import { ManifestStore } from "../../lib/core/ManifestStore";
import { tup, packet, log } from "../../lib/utils";
import { delay, concatMap } from "rxjs/operators";

class FakeManifestStore implements ManifestStore {

    manifest: Manifest = undefined;
    delay: number = 0;

    load(): Observable<ManifestStore.LoadEvent> {
        return this.manifest 
                ? of(packet('Loaded', this.manifest))
                : empty();
    }    
    
    save(newManifest: Manifest): Observable<ManifestStore.SaveEvent> {
        return of(1).pipe(
                delay(this.delay),
                concatMap<any, ManifestStore.SaveEvent>(() => {
                    if(newManifest.version <= ((this.manifest && this.manifest.version) || 0))
                        return of(packet('Gazumped'));
                    else {
                        this.manifest = newManifest;
                        return of(packet('Saved'));
                    }
                }));
    }

}

export default FakeManifestStore;
