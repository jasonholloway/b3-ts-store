import { OperatorFunction, pipe, of } from "rxjs";
import { Manifest } from "./signals";
import { concatMap, share } from "rxjs/operators";
import { ManifestStore } from "./ManifestStore";
import { handle } from "../utils";

export const pullManifests =
    (manifestStore: ManifestStore) : OperatorFunction<any, Manifest> =>
    pipe(
        concatMap(() => 
            manifestStore.load()
                .pipe(
                    handle({
                        Loaded: manifest => of(manifest)
                    })
                )),
        share()
    );

