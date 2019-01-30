import { Dict, tup } from "../utils";
import { Era, Tuple2 } from "./slicer";
import { OperatorFunction, pipe, Observable, of } from "rxjs";
import { scan, map, concatAll } from "rxjs/operators";
import { Evaluable } from "./evaluable";

export type RefreshEra = ['RefreshEra']
export type SetThreshold = ['SetThreshold', number]
export type NewManifest = ['NewManifest', Manifest]

export interface Epoch extends Tuple2<'Epoch', [Manifest, Evaluable<any>]> {}

export type Signal = RefreshEra | NewManifest | SetThreshold | Epoch



export type Manifest = { 
    version: number,
    logBlocks: Dict<string[]> 
}


export const newEra = 
    () => ['RefreshEra'] as RefreshEra

export const newManifest = 
    (manifest: Manifest) => tup('NewManifest', manifest) as NewManifest

export const setThreshold =
    (thresh: number) => tup('SetThreshold', thresh) as SetThreshold;




    
export const emptyManifest: Manifest = { version: 0, logBlocks: {} }


const emptyEra = { id: 0, manifest: emptyManifest, thresh: 0, blocks: null };


export function specifier() : OperatorFunction<Signal, Era> {
    return pipe(
        scan(
            (prev$: Observable<Era>, signal: Signal) => {
                switch(signal[0]) {
                    case 'Epoch': {
                        const [manifest, blocks] = signal[1];
                        return prev$.pipe(
                                map(prev => ({ ...prev, manifest, blocks })));
                        }
                    case 'NewManifest': {
                        const manifest = signal[1];
                        return prev$.pipe(
                                map(prev => ({ ...prev, manifest })));
                        }
                    case 'SetThreshold': {
                        const thresh = signal[1];
                        return prev$.pipe(
                                map(prev => ({ ...prev, thresh })));
                        }
                    default:
                        return prev$;
                }
            },
            of(emptyEra)),
        concatAll(),
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
