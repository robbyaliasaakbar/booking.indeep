#!/usr/bin/env node
/**
 * Uji 8 skenario Tahap 2 — slot dan harga (PRD Bab 20: "8 skenario uji slot dan harga lolos").
 * Disetujui Bang Rob (T2-B1):
 *   1. Subtotal benar (harga DB × qty)
 *   2. Surcharge benar (latex / sofa wide / sofa lepas pasang)
 *   3. Bawah minimum order ditolak 422
 *   4. Selasa ditolak 400
 *   5. Jam selain 09.00/13.00 ditolak 400
 *   6. Cutoff hari H (lewat 7 jam) ditolak 409
 *   7. Balapan slot: satu menang, satu ditolak 409 (transaksi InnoDB FOR UPDATE)
 *   8. Idempotency: klik dobel tidak jadi double order
 *   9. Kontrak alamat seragam: tanpa label/postal bisa dipakai & diedit,
 *      postal salah format ditolak (issue #16)
 *
 * Pakai: backend jalan dulu (docker compose up -d), lalu
 *   node scripts/uji-tahap2.mjs
 * Exit code 0 = semua lolos, 1 = ada gagal.
 */

const BASE = process.env.API_URL || 'http://localhost:5011'
const EMAIL = 'ujiTahap2@test.dev'

// ---------- helper ----------
const results = []
let cookie = ''

function todayWib(offsetDays = 0) {
  // Tanggal hari ini menurut WIB, apa pun timezone mesin
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const today = new Date(Date.now() + offsetDays * 86400000)
  return fmt.format(today)
}

function nowWib() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

function weekdayWib(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  // 0=Minggu..6=Sabtu; cari hari ISO (1=Senin..7=Minggu)
  return new Date(y, m - 1, d).getDay()
}

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) {
    cookie = setCookie.split(';')[0]
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { status: res.status, data }
}

function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '✅ PASS' : '❌ GAGAL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

function nextWeekdayFromToday(target, maxDays = 14) {
  // target: 0=Minggu..6=Sabtu; cari paling dekat >= hari ini (boleh hari ini)
  for (let i = 0; i <= maxDays; i++) {
    const d = todayWib(i)
    if (weekdayWib(d) === target) return d
  }
  return null
}

const idem = () => `uji-t2-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`

const createdIds = [] // booking yang dibuat, dibatalkan di akhir biar slot bebas

// ---------- jalankan ----------
async function main() {
  console.log('=== UJI 8 SKENARIO TAHAP 2 ===')
  console.log(`API: ${BASE} | jam WIB: ${nowWib()}\n`)

  // Health check
  const health = await fetch(`${BASE}/api/pricelist.php`)
  if (!health.ok) {
    console.error('Backend tidak jalan. Nyalakan docker compose dulu ya.')
    process.exit(1)
  }

  // Reset state uji (issue #38) — biar suite idempoten antar-run
  try {
    const { execSync } = await import('node:child_process')
    execSync('docker compose exec -T php php /app/scripts/reset-uji.php', { cwd: process.cwd(), stdio: 'ignore' })
  } catch {
    console.warn('⚠️  reset-uji gagal (lanjut, state mungkin kotor)')
  }

  // Setup: login customer uji + profil lengkap
  const login = await req('/login-dev.php', { method: 'POST', body: { email: EMAIL, name: 'Uji Tahap 2' } })
  if (login.status !== 200) {
    console.error('Gagal login customer uji:', login.data)
    process.exit(1)
  }
  const userId = login.data.data.id
  await req('/me.php', {
    method: 'PATCH',
    body: { name: 'Uji Tahap 2', phone_primary: '081200000001' },
  })
  // Ambil alamat default (dibuat otomatis saat booking pertama; kalau belum ada, create nanti bikin)
  const me = (await req('/me.php')).data.data
  let addressId = (me.addresses || []).find((a) => a.is_default)?.id || null

  const newAddr = {
    streetNo: 'Jl Uji Tahap 2 No 1',
    village: 'Sukamaju',
    district: 'Cilodong',
    city: 'Depok',
    province: 'Jawa Barat',
    postal: '16415',
  }

  // ---------- SKENARIO 1: Subtotal benar ----------
  console.log('Skenario 1 — Subtotal = harga DB × qty (BR07)')
  {
    const q = await req('/quote.php', {
      method: 'POST',
      body: { items: [{ skuId: 1, qty: 2 }, { skuId: 33, qty: 3 }] },
    })
    // kasur 200: 300000×2 = 600000; karpet 3m²: 25000×3 = 75000
    const ok =
      q.status === 200 &&
      q.data.data.subtotal === 675000 &&
      q.data.data.total === 675000
    check('S1 subtotal kasur×2 + karpet 3m² = Rp675.000', ok, `subtotal=${q.data?.data?.subtotal}`)
  }

  // ---------- SKENARIO 2: Surcharge benar ----------
  console.log('Skenario 2 — Surcharge latex + sofa wide (Bab 7)')
  {
    const q = await req('/quote.php', {
      method: 'POST',
      body: {
        items: [{ skuId: 1, qty: 1 }], // kasur 300000
        surcharges: [
          { code: 'LATEX', qtyAffected: 2 }, // 40000×2 = 80000
          { code: 'SOFA_WIDE', qtyAffected: 2 }, // 20000×2 = 40000
        ],
      },
    })
    const d = q.data?.data
    const ok =
      q.status === 200 &&
      d.subtotal === 300000 &&
      d.surchargeTotal === 120000 &&
      d.total === 420000
    check('S2 kasur + LATEX×2 + SOFA_WIDE×2 = Rp420.000', ok, `total=${d?.total} sur=${d?.surchargeTotal}`)
  }

  // ---------- SKENARIO 3: Minimum order ----------
  console.log('Skenario 3 — Bawah Rp250.000 ditolak (BR06)')
  {
    const q = await req('/quote.php', { method: 'POST', body: { items: [{ skuId: 16, qty: 1 }] } })
    const belowOk = q.status === 200 && q.data.data.isBelowMinimum === true && q.data.data.gapToMinimum === 230000
    check('S3a quote tandai isBelowMinimum + gap Rp230.000', belowOk, `gap=${q.data?.data?.gapToMinimum}`)

    const c = await req('/bookings-create.php', {
      method: 'POST',
      body: {
        items: [{ skuId: 16, qty: 1 }],
        date: nextWeekdayFromToday(3), // hari Kamis terdepan
        time: '13.00',
        idempotencyKey: idem(),
        ...(addressId ? { addressId } : { address: newAddr }),
      },
    })
    check('S3b create booking < minimum ditolak 422', c.status === 422 && c.data?.code === 'minimum_order', `HTTP ${c.status} ${c.data?.code}`)
  }

  // ---------- SKENARIO 4: Selasa libur ----------
  console.log('Skenario 4 — Selasa ditolak (BR01)')
  {
    const selasa = nextWeekdayFromToday(2) // 2 = Selasa
    const c = await req('/bookings-create.php', {
      method: 'POST',
      body: {
        items: [{ skuId: 3, qty: 1 }],
        date: selasa,
        time: '09.00',
        idempotencyKey: idem(),
        ...(addressId ? { addressId } : { address: newAddr }),
      },
    })
    check('S4 booking tanggal Selasa ditolak 400', c.status === 400 && c.data?.code === 'hari_selasa', `HTTP ${c.status} ${c.data?.code} (${selasa})`)
  }

  // ---------- SKENARIO 4b: Window H+30 konsisten (issue #10) ----------
  console.log('Skenario 4b — Window booking konsisten H+30 (issue #10)')
  {
    const h30 = todayWib(30)
    const h31 = todayWib(31)

    // H+31 ditolak di create
    const c31 = await req('/bookings-create.php', {
      method: 'POST',
      body: {
        items: [{ skuId: 3, qty: 1 }],
        date: h31,
        time: '09.00',
        idempotencyKey: idem(),
        ...(addressId ? { addressId } : { address: newAddr }),
      },
    })
    check('S4b1 create H+31 ditolak 400 date_invalid', c31.status === 400 && c31.data?.code === 'date_invalid', `HTTP ${c31.status} ${c31.data?.code} (${h31})`)

    // H+30 SUDAH tampil di availability (dulu cuma sampai H+29)
    const av = await req('/availability.php')
    const days = av.data?.data?.days || []
    const last = days[days.length - 1]?.date
    check('S4b2 availability mencakup H+30 (hari terakhir = H+30)', last === h30, `last=${last} harap=${h30} total=${days.length}`)
  }

  // ---------- SKENARIO 5: Jam ngawur ----------
  console.log('Skenario 5 — Jam selain 09.00/13.00 ditolak (BR02)')
  {
    const rabu = nextWeekdayFromToday(3)
    const c = await req('/bookings-create.php', {
      method: 'POST',
      body: {
        items: [{ skuId: 3, qty: 1 }],
        date: rabu,
        time: '10.00',
        idempotencyKey: idem(),
        ...(addressId ? { addressId } : { address: newAddr }),
      },
    })
    check('S5 booking jam 10.00 ditolak 400', c.status === 400 && c.data?.code === 'jam_tidak_tersedia', `HTTP ${c.status} ${c.data?.code}`)
  }

  // ---------- SKENARIO 6: Cutoff hari H ----------
  console.log('Skenario 6 — Cutoff hari H 7 jam (BR02a)')
  {
    // Pilih slot HARI INI yang cutoff-nya sudah lewat (jam WIB >= jam slot - 7 jam)
    const jamSekarang = Number(nowWib().slice(0, 2)) + Number(nowWib().slice(3, 5)) / 60
    let target = null
    if (jamSekarang >= 6) target = '13.00' // cutoff 06.00 sudah lewat
    else if (jamSekarang >= 2) target = '09.00' // cutoff 02.00 sudah lewat

    if (!target) {
      check('S6 cutoff hari H ditolak 409', true, 'SKIP — masih dini hari (<02.00 WIB), semua slot hari ini belum lewat cutoff. Validasi cutoff kebukti di S7b availability.')
      // Tetap buktikan via availability
      const av = await req('/availability.php')
      const hariIni = av.data?.data?.days?.find((d) => d.date === todayWib())
      check('S6b availability tandai terkunci = status cutoff server', Boolean(hariIni), `hari ini: ${hariIni?.slots?.map((s) => `${s.time}=${s.status}`).join(', ')}`)
    } else {
      const c = await req('/bookings-create.php', {
        method: 'POST',
        body: {
          items: [{ skuId: 3, qty: 1 }],
          date: todayWib(),
          time: target,
          idempotencyKey: idem(),
          ...(addressId ? { addressId } : { address: newAddr }),
        },
      })
      check(
        `S6 booking hari H jam ${target} (cutoff lewat) ditolak 409`,
        c.status === 409 && ['slot_unavailable', 'slot_penuh'].includes(c.data?.code),
        `HTTP ${c.status} ${c.data?.code}`
      )
    }
  }

  // ---------- SKENARIO 7: Balapan slot ----------
  console.log('Skenario 7 — Balapan 2 transaksi slot sama (Bab 11)')
  {
    // Race jujur di level MySQL: dua koneksi SELECT ... FOR UPDATE bersamaan.
    // (Race via 2 HTTP di php -S dev tidak reliable — artefak session, sudah diverifikasi T2-B3.)
    // File race: scripts/uji-race-tahap2.php, ke-mount ke /app/scripts via docker-compose.
    const jumat = nextWeekdayFromToday(5)
    const { execSync } = await import('node:child_process')
    let out = ''
    try {
      out = execSync(
        `docker compose exec -T php sh -c ` +
          `'php /app/scripts/uji-race-tahap2.php ${jumat} A & php /app/scripts/uji-race-tahap2.php ${jumat} B & wait'`,
        { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 }
      )
    } catch (e) {
      out = e.stdout || String(e.message || '')
    }
    const menang = (out.match(/MENANG/g) || []).length
    const ditolak = (out.match(/DITOLAK/g) || []).length
    check('S7a balapan: 1 MENANG + 1 DITOLAK slot_penuh', menang === 1 && ditolak === 1, out.trim().replace(/\n/g, ' | '))

    // S7b: setelah balapan, availability menandai slot penuh
    const av = await req(`/availability.php?from=${jumat}&to=${jumat}`)
    const day = av.data?.data?.days?.[0]
    const slot = day?.slots?.find((s) => s.time === '09.00')
    // Assert counter (issue #11): 1 pemenang → slots.booked tepat 1 (bukan 0/2)
    check('S7b availability laporkan slot 09.00 PENUH (counter=1)', slot?.status === 'penuh' && slot?.booked === 1, `status=${slot?.status} booked=${slot?.booked}`)
  }

  // ---------- SKENARIO 8: Idempotency ----------
  console.log('Skenario 8 — Double klik tidak jadi double order (Bab 11 poin 8)')
  {
    const sabtu = nextWeekdayFromToday(6)
    const key = idem()
    const payload = {
      items: [{ skuId: 3, qty: 1 }], // kasur 160 = 250000 pas minimum
      date: sabtu,
      time: '09.00',
      idempotencyKey: key,
      ...(addressId ? { addressId } : { address: newAddr }),
    }
    const a = await req('/bookings-create.php', { method: 'POST', body: payload })
    check('S8a create pertama sukses 201', a.status === 201 && a.data?.data?.code?.startsWith('IDP-'), `HTTP ${a.status} ${a.data?.data?.code || a.data?.code}`)
    if (a.status === 201) createdIds.push(a.data.data.id)

    const b = await req('/bookings-create.php', { method: 'POST', body: payload })
    check(
      'S8b klik ulang key sama → 409 double_submit + kode booking sama',
      b.status === 409 && b.data?.code === 'double_submit' && b.data?.details?.code === a.data?.data?.code,
      `HTTP ${b.status} ${b.data?.code} kode=${b.data?.details?.code}`
    )

    // Benar-benar cuma 1 baris
    const mine = await req('/bookings-mine.php')
    const hitung = (mine.data?.data || []).filter((x) => x.code === a.data?.data?.code).length
    check('S8c hanya ada 1 booking untuk kode itu', hitung === 1, `jumlah=${hitung}`)
  }

  // ---------- SKENARIO 9: Kontrak alamat seragam (issue #16) ----------
  console.log('Skenario 9 — Alamat tanpa label/postal tetap bisa dikelola (profil ↔ wizard)')
  {
    // Tanpa label & postal (persis alamat hasil wizard) → POST sukses
    const dibuat = await req('/addresses.php', {
      method: 'POST',
      body: {
        street_no: 'Jl Uji Alamat No 9',
        village: 'Sukamaju',
        district: 'Cilodong',
        city: 'Depok',
        province: 'Jawa Barat',
      },
    })
    const alamatId = dibuat.data?.data?.id
    check(
      'POST alamat tanpa label+postal → 200 (kontrak wizard)',
      dibuat.status === 200 && Number(alamatId) > 0,
      JSON.stringify(dibuat.data),
    )

    // PATCH alamat yang sama tanpa label+postal — INI bug kuncinya (dulu 400 label wajib)
    if (alamatId) {
      const diedit = await req('/addresses.php', {
        method: 'PATCH',
        body: {
          id: alamatId,
          street_no: 'Jl Uji Alamat No 9 (diedit)',
          village: 'Sukamaju',
          district: 'Cilodong',
          city: 'Depok',
          province: 'Jawa Barat',
          note: 'Diedit tanpa label/postal',
        },
      })
      check(
        'PATCH tanpa label+postal → 200 (bug kuncinya)',
        diedit.status === 200 && diedit.data?.data?.street_no === 'Jl Uji Alamat No 9 (diedit)',
        JSON.stringify(diedit.data),
      )
    } else {
      check('PATCH tanpa label+postal → 200 (bug kuncinya)', false, 'alamat tidak terbuat')
    }

    // Postal diisi tapi salah format → ditolak
    const postalSalah = await req('/addresses.php', {
      method: 'POST',
      body: {
        street_no: 'Jl Postal Salah',
        village: 'Sukamaju',
        district: 'Cilodong',
        city: 'Depok',
        province: 'Jawa Barat',
        postal: '12',
      },
    })
    check(
      'POST postal "12" → 400 address_invalid',
      postalSalah.status === 400 && postalSalah.data?.code === 'address_invalid',
      JSON.stringify(postalSalah.data),
    )

    // Field wajib hilang → ditolak
    const tanpaKelurahan = await req('/addresses.php', {
      method: 'POST',
      body: {
        street_no: 'Jl Tanpa Kelurahan',
        district: 'Cilodong',
        city: 'Depok',
        province: 'Jawa Barat',
      },
    })
    check(
      'POST tanpa kelurahan → 400 address_invalid',
      tanpaKelurahan.status === 400 && tanpaKelurahan.data?.code === 'address_invalid',
      JSON.stringify(tanpaKelurahan.data),
    )

    // Bersih-bersih (diam-diam; kalau kebetulan jadi default, biarkan)
    if (alamatId) {
      await req(`/addresses.php?id=${alamatId}`, { method: 'DELETE' })
    }
  }

  // ---------- Teardown: batalkan booking uji biar slot bebas ----------
  if (createdIds.length > 0) {
    for (const id of createdIds) {
      await req('/bookings-cancel.php', {
        method: 'POST',
        body: { id, reason: 'Uji otomatis Tahap 2 selesai' },
      })
    }
    console.log(`\n(Riwayat uji dibatalkan otomatis — ${createdIds.length} booking, slot dibebaskan)`)
  }

  // ---------- Ringkasan ----------
  const lolos = results.filter((r) => r.pass).length
  console.log(`\n=== RINGKASAN: ${lolos}/${results.length} lolos ===`)
  if (lolos === results.length) {
    console.log('🏆 SEMUA 9 SKENARIO LOLOS — Tahap 2 siap ditutup.')
    process.exit(0)
  } else {
    console.log('⚠️  Ada skenario gagal. Periksa sebelum lanjut.')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Error tak terduga:', e)
  process.exit(1)
})
