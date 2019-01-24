import { ManifestStore } from "../bits";
import { OperatorFunction, pipe } from "rxjs";
import { Manifest } from "./specifier";
import { concatMap, share } from "rxjs/operators";

export type PullManifest = ['PullManifest', {}]

export const pullManifest = (): PullManifest => ['PullManifest', {}];

export const pullManifests =
    (manifestStore: ManifestStore) : OperatorFunction<PullManifest, Manifest> =>
    pipe(
        concatMap(([_]) => manifestStore.load()),     //but what happens if empty????
        share()
    );
