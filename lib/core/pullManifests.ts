import { ManifestStore } from "../bits";
import { OperatorFunction, pipe, of } from "rxjs";
import { Manifest, emptyManifest } from "./signals";
import { concatMap, share, defaultIfEmpty } from "rxjs/operators";

export const pullManifests =
    (manifestStore: ManifestStore) : OperatorFunction<any, Manifest> =>
    pipe(
        concatMap(() => 
            manifestStore.load()
                .pipe(defaultIfEmpty(emptyManifest))),
        share()
    );


    //what else does this need?
    //not much - 
    //
    //
