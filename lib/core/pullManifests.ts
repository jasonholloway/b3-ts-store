import { OperatorFunction, pipe } from "rxjs";
import { Manifest } from "./signals";
import { concatMap, share, map } from "rxjs/operators";
import { ManifestStore } from "./ManifestStore";
import { demux } from "../utils";

export const pullManifests =
    (manifestStore: ManifestStore) : OperatorFunction<any, Manifest> =>
    pipe(
        concatMap(() => 
            manifestStore.load()
                .pipe(
                    demux('Loaded', map(m => m)) //a nice overload here would be nice
                )),
        share()
    );

