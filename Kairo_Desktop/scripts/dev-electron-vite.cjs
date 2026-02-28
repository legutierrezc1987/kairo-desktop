const { spawn } = require('node:child_process')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn('npx electron-vite dev', {
  stdio: 'inherit',
  env,
  shell: true,
})

child.on('error', (err) => {
  console.error(`[KAIRO] Failed to start electron-vite dev: ${err.message}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
