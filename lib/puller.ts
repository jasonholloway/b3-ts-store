import { ManifestStore } from "./bits";
import { OperatorFunction, pipe } from "rxjs";
import { NewManifest, newManifest } from "./specifier";
import { concatMap, map } from "rxjs/operators";

export type PullManifest = ['PullManifest', {}]

export const pullManifest = (): PullManifest => ['PullManifest', {}];

export const puller =
    (manifestStore: ManifestStore) : OperatorFunction<PullManifest, NewManifest> =>
    pipe(
        concatMap(([_, pull]) => manifestStore.load()),     //but what happens if empty????
        map(manifest => newManifest(manifest))
    );
