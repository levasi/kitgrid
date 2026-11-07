import { spawn } from 'node:child_process'
import { buildElectron } from './build-electron.mjs'

const nuxt = spawn('npm', ['run', 'dev', '--', '--port', '3000', '--host', '127.0.0.1'], {
  stdio: 'inherit',
  env: process.env,
})

let electron

function stop(code = 0) {
  electron?.kill('SIGTERM')
  nuxt.kill('SIGTERM')
  process.exit(code)
}

try {
  await buildElectron()
  const url = await waitFor(['http://127.0.0.1:3000', 'http://localhost:3000'])
  electron = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    env: { ...process.env, TESSERA_DEV_URL: url },
  })
  electron.on('exit', () => stop(0))
  nuxt.on('exit', code => stop(code ?? 1))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  stop(1)
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

async function waitFor(urls) {
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    for (const url of urls) {
      try {
        const response = await fetch(url)
        if (response.status < 500) return url
      } catch {
        // The dev server is still starting.
      }
    }
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw new Error('Timed out waiting for the Nuxt dev server.')
}
