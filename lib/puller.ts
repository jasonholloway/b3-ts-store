import { ManifestStore } from "./bits";
import { OperatorFunction, pipe } from "rxjs";
import { NewManifest, newManifest, Manifest } from "./specifier";
import { concatMap, map, share } from "rxjs/operators";

export type PullManifest = ['PullManifest', {}]

export const pullManifest = (): PullManifest => ['PullManifest', {}];

export const puller =
    (manifestStore: ManifestStore) : OperatorFunction<PullManifest, Manifest> =>
    pipe(
        concatMap(([_, pull]) => manifestStore.load()),     //but what happens if empty????
        share()
    );
