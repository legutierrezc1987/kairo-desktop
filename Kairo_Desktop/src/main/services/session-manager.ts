import { randomUUID } from 'node:crypto'
import type { SessionState } from '../../shared/types'

export class SessionManager {
  private state: SessionState

  constructor() {
    this.state = this.createSession()
  }

  private createSession(): SessionState {
    return {
      sessionId: randomUUID(),
      turnCount: 0,
      totalTokens: 0,
      startedAt: Date.now(),
    }
  }

  startSession(): SessionState {
    this.state = this.createSession()
    return this.state
  }

  incrementTurn(tokenCount: number): void {
    this.state.turnCount++
    this.state.totalTokens += tokenCount
  }

  getState(): SessionState {
    return { ...this.state }
  }
}
