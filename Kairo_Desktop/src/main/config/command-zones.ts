/**
 * Command zone definitions — DEC-024 frozen.
 * SECURITY: These lists are the SINGLE SOURCE OF TRUTH for command classification.
 * Classification MUST be deterministic (pattern matching), NEVER LLM-inferred.
 * Unclassified commands default to RED (deny-by-default).
 */

/**
 * GREEN zone — always safe, both modes.
 * Matched against normalized (lowercase, trimmed) command.
 */
export const GREEN_PATTERNS: readonly string[] = Object.freeze([
  // Filesystem read-only
  'ls', 'dir', 'cd', 'pwd', 'cat', 'type', 'echo', 'head', 'tail',
  'find', 'where', 'which', 'tree', 'wc', 'diff', 'less', 'more',
  // Version checks
  'python --version', 'node --version', 'npm --version', 'pip --version',
  'git --version', 'java --version', 'dotnet --version',
  // Git read + standard workflow
  'git status', 'git add', 'git commit', 'git push', 'git pull',
  'git log', 'git diff', 'git branch', 'git checkout', 'git stash',
  'git fetch', 'git remote', 'git show', 'git tag', 'git merge',
  // Package listing
  'npm list', 'npm ls', 'pip list', 'pip freeze', 'pip show',
  // Directory creation (safe)
  'mkdir', 'touch',
  // Environment info
  'env', 'set', 'printenv', 'whoami', 'hostname', 'date', 'time',
])

/**
 * YELLOW zone — productive, permission-based in supervised mode.
 * Sprint A: allowed (mode toggle is Phase 2.3).
 */
export const YELLOW_PATTERNS: readonly string[] = Object.freeze([
  // Package management
  'npm install', 'npm i', 'npm run', 'npm start', 'npm test', 'npm build',
  'npm uninstall', 'npm update', 'npm init', 'npm create', 'npm exec', 'npx',
  'pip install', 'pip uninstall',
  // Script execution
  'python', 'node', 'ts-node', 'tsx', 'deno', 'bun',
  // File mutations (workspace-scoped — sandbox validates separately)
  'rm', 'del', 'rmdir', 'cp', 'mv', 'chmod',
  // Docker
  'docker', 'docker-compose',
  // Network
  'curl', 'wget',
  // Build tools
  'make', 'cargo', 'go',
])

/**
 * RED zone — ALWAYS BLOCKED regardless of mode.
 * Checked FIRST (highest priority).
 * Matched as prefix against normalized command string.
 */
export const RED_PATTERNS: readonly string[] = Object.freeze([
  // Disk destruction
  'format', 'diskpart', 'fdisk', 'mkfs',
  // Registry manipulation
  'regedit', 'reg add', 'reg delete', 'reg import', 'reg export',
  // User/group manipulation
  'net user', 'net localgroup', 'wmic useraccount', 'wmic',
  // System control
  'shutdown', 'restart', 'logoff',
  // Network config
  'netsh', 'route add', 'route delete',
  // Destructive wildcards
  'rm -rf /', 'del /s /q c:\\', 'rmdir /s /q c:\\',
  // PowerShell policy bypass
  'powershell -executionpolicy bypass', 'set-executionpolicy',
  // System environment (machine scope)
  '[system.environment]::setenvironmentvariable',
  // Privilege escalation
  'sudo',
])

/**
 * Allowed shell binaries — DEC-025.
 * SECURITY: Only these shells may be spawned by TerminalService.
 * Matched against basename (case-insensitive) of the shell path.
 */
export const ALLOWED_SHELLS: readonly string[] = Object.freeze([
  'cmd.exe', 'powershell.exe', 'pwsh.exe',
  'bash', 'sh', 'zsh', 'fish',
])

/**
 * YELLOW commands that mutate files — DEC-025.
 * Path arguments for these commands are validated against workspace boundary.
 */
export const YELLOW_FILE_COMMANDS: readonly string[] = Object.freeze([
  'rm', 'del', 'rmdir', 'cp', 'mv', 'chmod',
])

/**
 * YELLOW interpreter commands — DEC-025 Sprint C.1.
 * These commands execute script files. The first path-like argument
 * (the script file) is validated against workspace boundary.
 * SECURITY: Prevents `python /outside/evil.py` style sandbox escapes.
 */
export const YELLOW_INTERPRETER_COMMANDS: readonly string[] = Object.freeze([
  'python', 'python3', 'node', 'ts-node', 'tsx', 'deno', 'bun',
])

/**
 * Navigation commands — DEC-025 Sprint C.1 hardening.
 * These commands change the working directory of the shell.
 * The target directory argument is validated against workspace boundary.
 * SECURITY: Prevents `cd ../../` escaping workspace, then running
 * subsequent commands from an outside-workspace CWD.
 * Note: `cd` is GREEN-classified (safe to run) but its argument
 * must stay inside workspace.
 */
export const NAVIGATION_COMMANDS: readonly string[] = Object.freeze([
  'cd', 'chdir', 'pushd', 'popd',
])

/** Maximum lines of terminal output before truncation (PRD §10) */
export const TERMINAL_OUTPUT_TRUNCATE_LINES = 50
