export type FeatCondition = {
  readonly statId: string
  readonly operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'is'
  readonly value: number | string | boolean
}

export type RewardItem =
  | { readonly type: 'memoryFragments'; readonly amount: number }
  | { readonly type: 'unlock'; readonly id: string }

export type FeatReward = {
  readonly items: readonly RewardItem[]
}

export type FeatDefinition = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly conditions: readonly FeatCondition[]
  readonly reward: FeatReward
}
