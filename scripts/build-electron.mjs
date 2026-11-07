import * as esbuild from 'esbuild'
import { pathToFileURL } from 'node:url'

export async function buildElectron() {
  await esbuild.build({
    entryPoints: {
      main: 'electron/main.ts',
      preload: 'electron/preload.ts',
    },
    outdir: 'electron-dist',
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    external: ['electron'],
    outExtension: { '.js': '.cjs' },
    sourcemap: true,
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildElectron()
}
