#!/usr/bin/env node
/**
 * Rewrite SvelteKit adapter-static's absolute asset paths to relative ones
 * for itch.io HTML5 hosting.
 *
 * Why this script exists:
 *   itch.io serves each HTML5 game under a randomized subpath
 *   (html-classic.itch.zone/html/<id>/<hash>/…). SvelteKit's SPA fallback
 *   page always emits absolute /_app/immutable/… URLs regardless of
 *   `kit.paths.relative` (documented intentionally in the type defs:
 *   "Single-page app fallback pages will always use absolute paths").
 *   Those absolute URLs hit the root of html-classic.itch.zone where
 *   nothing exists → 403 on every chunk → the game never boots.
 *
 * Fix: rewrite every absolute /_app/…, /manifest.webmanifest, etc. in
 * build/index.html to use ./ instead of / so the browser resolves them
 * against the current page URL (which IS the game's subpath).
 *
 * Only touches build/index.html — chunks under build/_app/immutable
 * use relative imports natively (Vite's chunk graph is import-based).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const indexPath = resolve('build', 'index.html')
if (!existsSync(indexPath)) {
  console.error(`✗ ${indexPath} not found — did the build run?`)
  process.exit(1)
}

const before = readFileSync(indexPath, 'utf8')

// Replace href="/...", src="/...", and inline imports "/_app/…" with "./".
// The patterns are tight enough to not touch external URLs (those start
// with https:// or //) — only /-rooted same-origin asset references match.
const ABSOLUTE_ASSET = /(\b(?:href|src)=")\/((?:_app|manifest\.webmanifest|favicon\.[a-z]+|fx\/|robots\.txt))/g
const SCRIPT_IMPORT  = /("\)\.import\()"\/(_app\/)/g          // dynamic imports in inline script
const MODULE_PRELOAD = /(rel="modulepreload"[^>]*href=")\/((_app\/))/g

const after = before
  .replace(ABSOLUTE_ASSET, '$1./$2')
  .replace(MODULE_PRELOAD, '$1./$2')
  .replace(SCRIPT_IMPORT,  '$1"./$2')

// Also catch any remaining occurrences inside the bootstrap script blocks
// (start.<hash>.js / app.<hash>.js refs that aren't wrapped in href/src).
const STRING_LITERAL = /(["'])\/(_app\/immutable\/[^"']+)\1/g
const final = after.replace(STRING_LITERAL, '$1./$2$1')

writeFileSync(indexPath, final)

const absoluteBefore = (before.match(/(?:href|src)="\/_app/g) ?? []).length
const absoluteAfter  = (final .match(/(?:href|src)="\/_app/g) ?? []).length
console.log(`  /_app refs: ${absoluteBefore} absolute → ${absoluteAfter} remaining`)
if (absoluteAfter > 0) {
  console.warn('⚠  Some absolute /_app paths still present in index.html')
  process.exit(2)
}
console.log('✓ Rewrote build/index.html for itch.io subpath hosting')
