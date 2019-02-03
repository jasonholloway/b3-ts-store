import { ManifestStore } from "../bits";
import { OperatorFunction, pipe, of } from "rxjs";
import { Manifest, emptyManifest } from "./signals";
import { concatMap, share, defaultIfEmpty } from "rxjs/operators";

export type PullManifest = ['PullManifest', {}]

export const pullManifest = (): PullManifest => ['PullManifest', {}];

export const pullManifests =
    (manifestStore: ManifestStore) : OperatorFunction<PullManifest, Manifest> =>
    pipe(
        concatMap(([_]) => 
            manifestStore.load()
                .pipe(defaultIfEmpty(emptyManifest))),
        share()
    );


    //
    //
    //
    //
