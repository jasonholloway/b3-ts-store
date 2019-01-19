
export type RefreshEra = ['RefreshEra']

export type NewManifest = ['NewManifest', {}]

export type Signal = RefreshEra | NewManifest



export const newEra = () => ['RefreshEra'] as RefreshEra
