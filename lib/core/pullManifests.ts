import { OperatorFunction, pipe } from "rxjs";
import { Manifest } from "./signals";
import { concatMap, share } from "rxjs/operators";
import { ManifestStore } from "./ManifestStore";
import { extract } from "../utils";

export const pullManifests =
    (manifestStore: ManifestStore) : OperatorFunction<any, Manifest> =>
    pipe(
        concatMap(() => 
            manifestStore.load()
                .pipe(
                    extract('Loaded')
                )),
        share()
    );

