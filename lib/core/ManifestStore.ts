import { Observable } from "rxjs";
import { Manifest } from "./signals";

type Result =  ['Saved', void] | ['Gazumped', void]

export interface ManifestStore {
    load(): Observable<Manifest>;
    save(manifest: Manifest): Observable<Result>
}
