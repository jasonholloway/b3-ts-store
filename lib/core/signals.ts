import { Dict, tup } from "../utils";
import { Evaluable } from "./evaluable";
import { Tuple2, Era, Epoch } from "./eraSlicer";

export type RefreshEra = ['RefreshEra']
export type SetThreshold = ['SetThreshold', number]
export type NewManifest = ['NewManifest', Manifest]
export type DoReset = ['DoReset']
export type NewSlice = ['NewSlice', number]
export type Start = ['Start']

export interface NewEpoch extends Tuple2<'Epoch', [Epoch, Evaluable<any>]> {}

export type Signal = RefreshEra | NewManifest | SetThreshold | NewEpoch | DoReset | Start



export type Manifest = { 
    version: number,
    logBlocks: Dict<string[]> 
}


export const refreshEra = 
    () => ['RefreshEra'] as RefreshEra;

export const setThreshold =
    (thresh: number) => tup('SetThreshold', thresh) as SetThreshold;

export const doReset =
    () => ['DoReset'] as DoReset;


    
export const emptyManifest: Manifest = { version: 0, logBlocks: {} }

