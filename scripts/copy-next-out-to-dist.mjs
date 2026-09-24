import { cpSync, rmSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const outDir = resolve(root, 'out')
const distDir = resolve(root, 'dist')

rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })
cpSync(outDir, distDir, { recursive: true, force: true })

copyFileSync(resolve(root, 'public', 'web.config'), resolve(distDir, 'web.config'))

console.log('Copied Next static export from out/ to dist/.')

