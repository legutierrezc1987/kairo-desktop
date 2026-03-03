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
 * Strip invisible / non-printable noise from raw terminal input.
 * Removes ANSI escape sequences (CSI, OSC, bracketed paste markers),
 * zero-width Unicode (U+200B/C/D, U+FEFF BOM), and control chars 0x00-0x1F
 * except \t (0x09), \r (0x0D), \n (0x0A) — CR/LF are preserved so
 * detectChainOperator can still catch CR/LF injection.
 * Collapses multiple spaces into single space.
 *
 * SECURITY: Does NOT alter semantic command content — only cleans invisible
 * transport noise. DEC-024 deny-by-default is preserved.
 */
function normalizeInput(raw: string): string {
  let cleaned = raw
  // 1. ANSI CSI sequences: ESC[ params final_byte (includes bracketed paste \x1b[200~ / \x1b[201~)
  cleaned = cleaned.replace(/\x1b\[[0-9;?]*[A-Za-z~]/g, '')
  // 2. ANSI OSC sequences: ESC] ... BEL or ST
  cleaned = cleaned.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
  // 3. ANSI charset selection: ESC( or ESC) followed by designator
  cleaned = cleaned.replace(/\x1b[()][A-Z0-9]/g, '')
  // 4. Other bare ESC sequences
  cleaned = cleaned.replace(/\x1b[^[\]()]/g, '')
  // 5. Zero-width Unicode characters and BOM
  cleaned = cleaned.replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
  // 6. Control characters 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F (preserve \t \r \n)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  // 7. Collapse multiple spaces into single space
  cleaned = cleaned.replace(/ {2,}/g, ' ')
  return cleaned
}

/**
 * Deterministic command classifier — DEC-024.
 * SECURITY: Classification is hardcoded pattern matching, NEVER LLM-inferred.
 * Priority: CHAIN_INJECTION > RED > GREEN > YELLOW > default RED (deny-by-default).
 */
export function classifyCommand(rawCommand: string): ClassificationResult {
  const command = normalizeInput(rawCommand).trim()
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
