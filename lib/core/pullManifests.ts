import { ManifestStore } from "../bits";
import { OperatorFunction, pipe, of } from "rxjs";
import { Manifest, emptyManifest } from "./specifier";
import { concatMap, share, defaultIfEmpty } from "rxjs/operators";
import { log } from "../utils";

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
