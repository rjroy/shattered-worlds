import starterJson from '../data/worlds/starter.json'
import zombieJson from '../data/worlds/zombie-big-box.json'
import type { RawCardSource } from '../core/catalog'

export const STARTER_SOURCE = starterJson as unknown as RawCardSource
export const ZOMBIE_SOURCE = zombieJson as unknown as RawCardSource
