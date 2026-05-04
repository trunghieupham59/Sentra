import type { StateCreator } from 'zustand'

// biome-ignore lint/suspicious/noExplicitAny: slices are typed before the full root AppState is assembled.
type RootStateCreator = StateCreator<any, [], [], any>

export type SliceSet = Parameters<RootStateCreator>[0]
export type SliceGet = Parameters<RootStateCreator>[1]
