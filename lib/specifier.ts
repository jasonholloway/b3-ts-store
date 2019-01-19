import { Dict, tup } from "./utils";
import { Era } from "./slicer";
import { OperatorFunction, pipe } from "rxjs";
import { scan, map } from "rxjs/operators";

export type RefreshEra = ['RefreshEra']
export type SetThreshold = ['SetThreshold', number]
export type NewManifest = ['NewManifest', Manifest]

export type Signal = RefreshEra | NewManifest | SetThreshold



export type Manifest = { 
    id: number,
    logBlocks: Dict<string[]> 
}


export const newEra = 
    () => ['RefreshEra'] as RefreshEra

export const newManifest = 
    (manifest: Manifest) => tup('NewManifest', manifest) as NewManifest

export const setThreshold =
    (thresh: number) => tup('SetThreshold', thresh) as SetThreshold;






export interface EraWithSpec extends Era {
    thresh: number,
    manifest: Manifest
}
    
export const emptyManifest: Manifest = { id: 0, logBlocks: {} }
    
    
export function specifier() : OperatorFunction<Signal, EraWithSpec> {
    return pipe(
        scan(
            (prev: EraWithSpec, signal: Signal) => {
                switch(signal[0]) {
                    case 'NewManifest':
                        return { ...prev, manifest: signal[1] };

                    case 'SetThreshold':
                        return { ...prev, thresh: signal[1] };

                    default:
                        return prev;
                }
            },
            { id: 0, thresh: 0, manifest: emptyManifest }),
        map((era, id) => ({ ...era, id }))
    );
}
    


//eras will have:

//LOCAL ---------------------------
//thresholds
//eras of slices, evaluables
//blocks


//MANIFEST ------------------------
//blockMaps
//manifest ID
//
//so thresholds are local things, that go with slices
//while blockMaps are parts of manifests, that will carry their own id
//the manifest + blockLoader would be used by the evaluator
//
