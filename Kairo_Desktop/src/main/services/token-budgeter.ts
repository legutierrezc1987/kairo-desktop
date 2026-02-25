import type { TokenChannel, TokenBudgetState, ChannelBudget } from '../../shared/types'
import { CHANNEL_ALLOCATIONS, DEFAULT_BUDGET } from '../../shared/constants'

const ALL_CHANNELS: TokenChannel[] = ['chat', 'terminal', 'diffs', 'memory', 'system', 'buffer']

export class TokenBudgeter {
  private totalBudget: number
  private usage: Record<TokenChannel, number>

  constructor(totalBudget: number = DEFAULT_BUDGET) {
    this.totalBudget = totalBudget
    this.usage = { chat: 0, terminal: 0, diffs: 0, memory: 0, system: 0, buffer: 0 }
  }

  record(channel: TokenChannel, tokens: number): void {
    this.usage[channel] += tokens
  }

  getChannelBudget(channel: TokenChannel): ChannelBudget {
    const allocated = Math.floor(this.totalBudget * CHANNEL_ALLOCATIONS[channel])
    const used = this.usage[channel]
    return {
      channel,
      allocated,
      used,
      percentage: allocated > 0 ? (used / allocated) * 100 : 0,
    }
  }

  isOverBudget(channel: TokenChannel): boolean {
    const budget = this.getChannelBudget(channel)
    return budget.used >= budget.allocated
  }

  getState(): TokenBudgetState {
    const channels = {} as Record<TokenChannel, ChannelBudget>
    let totalUsed = 0

    for (const ch of ALL_CHANNELS) {
      channels[ch] = this.getChannelBudget(ch)
      totalUsed += this.usage[ch]
    }

    return { totalBudget: this.totalBudget, totalUsed, channels }
  }

  reset(): void {
    this.usage = { chat: 0, terminal: 0, diffs: 0, memory: 0, system: 0, buffer: 0 }
  }
}
