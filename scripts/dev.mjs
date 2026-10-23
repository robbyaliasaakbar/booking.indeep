#!/usr/bin/env node
/**
 * npm run dev — perintah dev gabungan (PRD Bab 14.5):
 * 1. Nyalain Docker (MariaDB + backend PHP :5011)
 * 2. Auto seed bila pricelist masih kosong (database fresh)
 * 3. Nyalain Vite + tampilkan URL aktif (port auto geser bila 5173 penuh)
 *
 * Murni Node bawaan — tanpa dependency tambahan.
 */

import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = 5011 // keputusan Bang Rob — port 8000 dipakai app lain

const info = (msg) => console.log(`\x1b[36m[dev]\x1b[0m ${msg}`)
const ok = (msg) => console.log(`\x1b[32m[dev]\x1b[0m ${msg}`)

function compose(...args) {
  execFileSync('docker', ['compose', ...args], { cwd: ROOT, stdio: 'inherit' })
}

/** Tunggu backend PHP merespon. null = server hidup tapi tabel belum ada (butuh seed). */
async function apiReady() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${API_PORT}/api/pricelist.php`)
      if (res.ok) return await res.json()
      if (res.status === 500) return null
    } catch {
      // backend belum siap, coba lagi
    }
    await sleep(1000)
  }
  throw new Error(
    `Backend :${API_PORT} tidak merespon. Cek log dengan: docker compose logs php`,
  )
}

console.log('')
console.log('  App InDeep Booking — mode dev')
console.log('  ------------------------------')

info('Menyiapkan Docker (MariaDB + PHP :' + API_PORT + ')...')
compose('up', '-d')

info('Menunggu backend siap...')
const pricelist = await apiReady()

if (!pricelist || pricelist.data.length === 0) {
  info('Database masih kosong — auto seed 44 SKU + surcharge + admin...')
  execFileSync('docker', ['compose', 'run', '--rm', 'php', 'php', 'scripts/seed.php'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  ok('Seed selesai.')
} else {
  ok(`Database siap — ${pricelist.data.length} SKU pricelist aktif.`)
}

info('Menyalakan Vite...')
const vite = spawn('npm', ['--prefix', 'web', 'run', 'dev'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let webUrl = null
let summaryShown = false

function showSummary() {
  if (summaryShown) return
  summaryShown = true
  console.log('')
  console.log('\x1b[33m' + '='.repeat(52))
  console.log('  SEMUA SIAP — App InDeep Booking')
  console.log(`  Web   : ${webUrl}`)
  console.log(`  API   : http://localhost:${API_PORT}`)
  console.log(`  Admin : ${webUrl}/admin/login`)
  console.log('  Login : username & password dari config/config.php (SEED_ADMIN_*)')
  console.log('  Ctrl+C buat matiin Vite (Docker biarkan jalan)')
  console.log('='.repeat(52) + '\x1b[0m')
}

vite.stdout.on('data', (buf) => {
  process.stdout.write(buf)
  if (!webUrl) {
    const m = String(buf).match(/https?:\/\/localhost:(\d+)\//)
    if (m) {
      webUrl = `http://localhost:${m[1]}`
      showSummary()
    }
  }
})

vite.stderr.on('data', (buf) => process.stderr.write(buf))

function stop(signal) {
  info(`Matiin Vite (${signal})...`)
  vite.kill('SIGTERM')
  setTimeout(() => process.exit(0), 300)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

vite.on('exit', (code) => process.exit(code ?? 0))
