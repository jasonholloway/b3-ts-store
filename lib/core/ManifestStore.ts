import { Observable } from "rxjs";
import { Manifest } from "./signals";

export declare module ManifestStore {
    export type LoadEvent = ['Loaded', Manifest]
    export type SaveEvent =  ['Saved', void] | ['Gazumped', void]
}


export interface ManifestStore {
    load(): Observable<ManifestStore.LoadEvent>;
    save(manifest: Manifest): Observable<ManifestStore.SaveEvent>
}

