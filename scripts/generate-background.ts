/**
 * Pre-build script: generates shuimo-core procedural landscape as PNG
 * Saves to public/shuimo-bg.png
 *
 * Usage: npx tsx scripts/generate-background.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SVG_OUT = path.join(ROOT, 'public', 'shuimo-bg.svg')
const PNG_OUT = path.join(ROOT, 'public', 'shuimo-bg.png')

async function main() {
  console.log('[generate-bg] Generating shuimo landscape...')

  const { PaintingGenerator } = await import('@jobinjia/shuimo-core')

  // 1440×900 covers most screens; use 2x for retina
  const W = 1440
  const H = 900

  const result = PaintingGenerator.landscape({
    width: W,
    height: H,
    seed: Date.now(),
    onXuanPaper: false,
    transparent: true,
    blankPosition: 'none',
    minCounts: { mount: 6, flatmount: 3, arch01: 2, arch03: 1 },
  })

  // Save SVG for reference (not used by the app)
  fs.writeFileSync(SVG_OUT, result.svg, 'utf-8')

  // Convert SVG → PNG via sharp (uses sharp's built-in SVG renderer)
  const svgBuffer = Buffer.from(result.svg, 'utf-8')
  await sharp(svgBuffer, { density: 144 })
    .resize(W, H)
    .png({ compressionLevel: 6, quality: 80 })
    .toFile(PNG_OUT)

  const sizeMB = (fs.statSync(PNG_OUT).size / 1024 / 1024).toFixed(2)
  console.log(`[generate-bg] ✓ Saved PNG: ${PNG_OUT} (${sizeMB} MB)`)
}

main().catch((err) => {
  console.error('[generate-bg] Error:', err)
  process.exit(1)
})
