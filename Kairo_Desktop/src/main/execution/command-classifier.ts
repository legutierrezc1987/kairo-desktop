import { GREEN_PATTERNS, YELLOW_PATTERNS, RED_PATTERNS } from '../config/command-zones'
import type { ClassificationResult } from '../../shared/types'

/**
 * Shell chaining / injection operators.
 * SECURITY: If ANY of these appear in user input, the entire command is RED.
 * This prevents bypass attacks like `echo hi && format c:`.
 * Order: longest first to avoid partial matches.
 */
const CHAIN_OPERATORS: readonly string[] = Object.freeze([
  '&&', '||', ';', '|', '&', '`',
])

/**
 * Check for shell chaining/injection operators in normalized input.
 * Returns the first detected operator, or null if clean.
 */
function detectChainOperator(normalized: string): string | null {
  // CR/LF injection (embedded newlines)
  if (normalized.includes('\r') || normalized.includes('\n')) {
    return 'CR/LF injection'
  }
  for (const op of CHAIN_OPERATORS) {
    if (normalized.includes(op)) {
      return op
    }
  }
  return null
}

/**
 * Deterministic command classifier — DEC-024.
 * SECURITY: Classification is hardcoded pattern matching, NEVER LLM-inferred.
 * Priority: CHAIN_INJECTION > RED > GREEN > YELLOW > default RED (deny-by-default).
 */
export function classifyCommand(rawCommand: string): ClassificationResult {
  const command = rawCommand.trim()
  const normalized = command.toLowerCase()
  const timestamp = Date.now()

  // 0. CHAIN/INJECTION check (highest priority — always RED)
  const chainOp = detectChainOperator(normalized)
  if (chainOp) {
    return {
      command, zone: 'red',
      reason: `Blocked: command contains shell chaining operator "${chainOp}" — injection risk`,
      matchedPattern: chainOp, timestamp,
    }
  }

  // 1. RED check (highest priority — blocked commands)
  const redMatch = matchPatterns(normalized, RED_PATTERNS)
  if (redMatch) {
    return {
      command, zone: 'red',
      reason: `Blocked: matches red zone pattern "${redMatch}"`,
      matchedPattern: redMatch, timestamp,
    }
  }

  // 2. GREEN check (safe commands)
  const greenMatch = matchPatterns(normalized, GREEN_PATTERNS)
  if (greenMatch) {
    return {
      command, zone: 'green',
      reason: `Safe: matches green zone pattern "${greenMatch}"`,
      matchedPattern: greenMatch, timestamp,
    }
  }

  // 3. YELLOW check (productive, permission-based)
  const yellowMatch = matchPatterns(normalized, YELLOW_PATTERNS)
  if (yellowMatch) {
    return {
      command, zone: 'yellow',
      reason: `Productive: matches yellow zone pattern "${yellowMatch}"`,
      matchedPattern: yellowMatch, timestamp,
    }
  }

  // 4. DEFAULT: unclassified = RED (deny-by-default — DEC-024)
  return {
    command, zone: 'red',
    reason: 'Unclassified command — denied by default (DEC-024)',
    matchedPattern: null, timestamp,
  }
}

/**
 * Match a normalized command against a list of patterns.
 * Returns the first matching pattern, or null.
 *
 * Strategy (deterministic, no regex):
 * - Multi-word pattern (e.g. "git status"): command.startsWith(pattern)
 * - Single-word pattern (e.g. "ls"): first token === pattern OR command.startsWith(pattern + ' ')
 */
function matchPatterns(
  normalized: string,
  patterns: readonly string[]
): string | null {
  for (const pattern of patterns) {
    if (pattern.includes(' ')) {
      if (normalized.startsWith(pattern)) {
        return pattern
      }
    } else {
      if (normalized === pattern || normalized.startsWith(pattern + ' ')) {
        return pattern
      }
    }
  }
  return null
}
