# 🧠 PROJECT BRAIN — BrewMetrics POS & Analytics

> Dokumen induk (single source of truth) untuk seluruh aplikasi: arsitektur, skema data, alur bisnis, API, kredensial demo, cara setup lokal, dan panduan deploy produksi.

---

## 1. Ringkasan Produk

**BrewMetrics POS & Analytics** adalah sistem Point of Sale + analitik all-in-one untuk bisnis F&B (fokus: kedai kopi), dengan proposisi nilai utama:

| Masalah | Solusi |
|---|---|
| POS standar hanya melacak stok barang jadi | **Recipe-Based Inventory (Bill of Materials)** — setiap gelas terjual otomatis memotong biji kopi, susu, sirup per gram/ml secara real-time |
| SaaS POS berlangganan menggerus margin | Model **Jual Putus (one-time payment)** — tanpa biaya bulanan |
| Prediksi stok hanya ada di software enterprise | **AI Sales Forecasting** sederhana — memprediksi kapan bahan habis dari velocity penjualan 14 hari |
| Internet kafe tidak stabil | **Offline Tolerance** — kasir tetap transaksi saat offline, auto-sync idempotent saat online kembali |
| Owner jauh dari lokasi | **Owner Cockpit** real-time + **Low-Stock AI Alert** yang bisa di-broadcast ke WhatsApp |

### Persona & Peran

| Peran | Login | Hak Akses |
|---|---|---|
| `cashier` | PIN | POS Terminal, riwayat order hari ini |
| `manager` | PIN | POS + Inventory Matrix (restock, edit, tambah bahan) + Analytics |
| `owner` | PIN | Semua + laporan keuangan lengkap, buku kas, reset data demo |

---

## 2. Tech Stack (Implementasi Aktual)

| Layer | Teknologi |
|---|---|
| Framework | **Next.js 16.2.6** (App Router, Turbopack) + React 19 + TypeScript |
| Styling | **Tailwind CSS v4** (token tema via `@theme` di `globals.css`) |
| Database | **PostgreSQL** lokal via **Drizzle ORM 0.45** (`drizzle-orm/node-postgres`) |
| Auth | **PIN → HMAC-SHA256 signed httpOnly cookie** (`bm_session`, 14 jam) — tanpa library auth eksternal |
| Charts | **Recharts** (area, bar, donut) |
| Animasi | **Framer Motion** (layout animation, sheet, drawer, toast) |
| Ikon | **Lucide React** (tanpa emoji di UI) |
| Font | `Space Grotesk` (display/angka) + `Plus Jakarta Sans` (body) via `next/font` |
| Offline | `localStorage` queue + service-window online events (client-side) |
| WhatsApp | Deep link `wa.me/?text=…` (tanpa API key — terbuka langsung di WA dengan ringkasan alert) |

> **Catatan vs brief awal:** brief menyebut Supabase + Netlify. Implementasi final memakai **PostgreSQL lokal + Drizzle ORM** (satu codebase Next.js, lebih sederhana dan self-contained). Perubahan ke Supabase hanya butuh mengganti `DATABASE_URL` ke connection string Supabase Postgres — semua query sudah kompatibel.

---

## 3. Struktur Project

```
├── drizzle.config.json          # konfigurasi Drizzle Kit (push schema)
├── package.json
├── public/images/login-hero.jpg # hero cinematic halaman login
└── src/
    ├── db/
    │   ├── index.ts             # pool pg + drizzle client (schema included)
    │   └── schema.ts            # 11 tabel (lihat §4)
    ├── lib/
    │   ├── auth.ts              # sesi HMAC cookie (server-only)
    │   ├── seed.ts              # ensureSeeded() idempotent + force reseed
    │   ├── recipes.ts           # RecipeIndex — peta Bill of Materials + HPP
    │   ├── orders.ts            # createOrder() transaksional + idempotensi
    │   ├── forecast.ts          # velocity forecasting 14 hari
    │   ├── types.ts             # DTO bersama client/server
    │   ├── format.ts            # rupiah, qty g/ml/L/kg, tanggal
    │   ├── nav.ts               # role → home, tab navigasi per peran
    │   ├── cart.ts              # CartLine + payload builder (client)
    │   └── offline.ts           # antrean offline localStorage + flushQueue
    ├── app/
    │   ├── layout.tsx           # font, metadata, dark shell
    │   ├── globals.css          # token tema, utilitas custom
    │   ├── page.tsx             # halaman login (PIN pad)
    │   ├── pos/page.tsx         # POS Terminal (orkestrator)
    │   ├── inventory/page.tsx   # Inventory Matrix
    │   ├── analytics/page.tsx   # Owner Cockpit
    │   └── api/
    │       ├── health/route.ts          # GET  healthcheck DB
    │       ├── auth/login/route.ts      # POST {pin} → set cookie (juga trigger seed)
    │       ├── auth/logout/route.ts     # POST hapus cookie
    │       ├── auth/me/route.ts         # GET sesi aktif
    │       ├── catalog/route.ts         # GET katalog POS
    │       ├── orders/route.ts          # GET order hari ini | POST buat order
    │       ├── inventory/route.ts       # GET matrix + forecast | POST tambah bahan
    │       ├── inventory/[id]/route.ts  # PATCH restock/set/edit (+ kas keluar opsional)
    │       ├── analytics/summary/route.ts # GET agregat dashboard
    │       ├── cash-movements/route.ts  # GET buku kas | POST catat kas
    │       └── admin/reseed/route.ts    # POST reset data demo (owner)
    └── components/
        ├── LoginScreen.tsx      # split-screen hero + PIN pad
        ├── AppShell.tsx         # guard sesi + top bar + nav per peran
        ├── pos/
        │   ├── icons.ts         # map string → komponen Lucide
        │   ├── CatalogPane.tsx  # rail kategori + grid produk + search
        │   ├── VariantSheet.tsx # sheet varian + modifier + qty
        │   ├── TicketPane.tsx   # struk aktif + tombol bayar
        │   ├── PaymentModal.tsx # tunai/QRIS/debit + kembalian + struk sukses
        │   └── OrdersDrawer.tsx # slide-over pesanan hari ini
        └── analytics/Charts.tsx # RevenueChart, HourlyChart, TopProducts, PaymentDonut
```

---

## 4. Skema Database (11 Tabel)

| Tabel | Kolom Kunci | Fungsi |
|---|---|---|
| `users` | name, **pin**, role (`cashier/manager/owner`) | Multi-role access |
| `categories` | name, icon, sortOrder | Rail kategori POS |
| `products` | categoryId, name, tagline, **price (IDR int)**, color, icon | Kartu menu |
| `variants` | productId, name (`Panas/Dingin`), priceDelta | Varian suhu + selisih harga |
| `modifiers` | name, price | Tambahan (Extra Shot, Susu Oat, dll) |
| `ingredients` | name, unit (**g/ml/pcs**), stockQty `double`, lowThreshold, costPerUnit | Stok bahan presisi |
| `recipe_items` | productId, **variantId nullable**, ingredientId, qty | **Bill of Materials** — `variantId NULL` = berlaku semua varian |
| `modifier_ingredients` | modifierId, ingredientId, qty | Resep untuk modifier |
| `orders` | orderNumber (unik), **offlineId (unik, idempotensi)**, cashierId, status, paymentMethod, subtotal, **hpp, profit**, tendered, change, isOfflineSync | Transaksi |
| `order_items` | orderId, productName+variantName (snapshot), qty, unitPrice, hpp, modifiers `jsonb` | Line item |
| `cash_movements` | type `in/out`, amount, note, userName | Buku kas non-penjualan |

**Aturan penting:**
- Harga disimpan sebagai **integer Rupiah**; kuantitas bahan sebagai **double** (gram/ml bisa pecahan).
- `orderNumber` format `BM-YYMMDD-XXX` (sekuens harian).
- `offlineId` adalah kunci idempotensi — `uniqueIndex` memastikan sync offline tidak dobel.

---

## 5. Alur Bisnis Inti

### 5.1 Ledakan Resep (BOM Explosion) — `src/lib/recipes.ts`
`RecipeIndex` di-cache 10 detik di memori server, berisi:
- `baseRows` (productId → bahan, berlaku semua varian)
- `variantRows` (variantId → bahan khusus, mis. es batu + cup 16oz untuk Dingin)
- `modifierRows` (modifierId → bahan)

Contoh: **1 Kopi Susu Gula Aren (Dingin) + Sirup Vanila** =
`18g biji + 90ml susu + 15ml gula + 120g es + 1 cup16 + 10ml vanila` → **HPP ≈ Rp 9.740/gelas**.

### 5.2 Transaksi & Potong Stok — `createOrder()` di `src/lib/orders.ts`
1. **Idempotensi**: jika `offlineId` sudah ada → kembalikan struk lama (tanpa potong stok ulang).
2. **Validasi server-side**: semua harga dihitung ulang dari DB (klien tidak dipercaya), qty di-clamp 1–20.
3. **Transaksi PostgreSQL**:
   - `SELECT … FOR UPDATE` mengunci baris bahan yang terpakai (anti race-condition).
   - Cek kecukupan stok → jika kurang: **rollback total** + error `409 INSUFFICIENT_STOCK` beserta detail `{name, need, have, unit}`.
   - `UPDATE ingredients SET stock_qty = stock_qty - qty`.
   - Insert `orders` (nomor sekuens harian) + `order_items` (dengan snapshot nama/harga/HPP).

### 5.3 AI Sales Forecasting — `src/lib/forecast.ts`
- Agregasi pemakaian per bahan dari `order_items` 14 hari terakhir, diletakkan kembali melalui `RecipeIndex` (nama varian/modifier dipetakan via snapshot).
- `dailyUsage = totalUsage14d / daysWithData` → `daysLeft = stockQty / dailyUsage`.
- Klasifikasi: `daysLeft ≤ 2` → **critical** (merah), `≤ 5` → **warning** (amber).
- `suggestedOrder = ceil(dailyUsage × 7 − stock)` — saran kuantitas restock untuk buffer 7 hari.
- Panel alert bisa di-broadcast ke WhatsApp owner via deep link `wa.me` berisi ringkasan terformat.

### 5.4 Offline Tolerance — `src/lib/offline.ts`
- Saat `navigator.onLine === false` atau fetch gagal → order masuk antrean `localStorage` (`bm_offline_queue_v1`) dengan `offlineId` unik, struk provisional tetap tercetak.
- Strip indikator oranye muncul di POS; event `online` + interval 15 detik memicu `flushQueue()`.
- Karena server idempotent, flush ganda aman. Payload dengan stok kurang dibuang dari antrean agar tidak macet.

### 5.5 Sesi & Otorisasi — `src/lib/auth.ts`
- `POST /api/auth/login` → verifikasi PIN → cookie `bm_session` = `base64url(payload).HMAC-SHA256`, `httpOnly`, `sameSite=lax`, 14 jam.
- Secret dari `SESSION_SECRET` (fallback dev string — **wajib diset di produksi**).
- Setiap route API memanggil `requireRole([...])`; client diguard oleh `AppShell` (fetch `/api/auth/me`, redirect sesuai peran).

### 5.6 Data Demo — `ensureSeeded()` di `src/lib/seed.ts`
- Idempotent (cek tabel `users`), dipicu otomatis saat pertama kali `/api/auth/login` atau `/api/catalog` dipanggil.
- Mengisi: 4 user, 4 kategori, **18 produk**, 25 varian, 5 modifier, **15 bahan**, 74 baris resep, **~797 order historis 30 hari** (RNG deterministik `mulberry32` — grafik selalu konsisten), 11 gerakan kas.
- Level stok disetel agar demo langsung memicu alert: **Biji Kopi ≈ 1,1 hari (kritis)**, Susu FC ≈ 1,1 hari, Susu Oat ≈ 1,5 hari, dll.
- `ensureSeeded(true)` (via `POST /api/admin/reseed`, owner-only) = `TRUNCATE … RESTART IDENTITY CASCADE` lalu seed ulang.

---

## 6. Referensi API

| Method & Path | Role | Body / Hasil |
|---|---|---|
| `POST /api/auth/login` | publik | `{pin}` → `{user}` + cookie; `401` PIN salah |
| `POST /api/auth/logout` | semua | → `{ok}` |
| `GET /api/auth/me` | semua | → `{user \| null}` |
| `GET /api/catalog` | semua | → kategori, produk, varian, modifier |
| `GET /api/orders` | semua | → 60 order terakhir hari ini |
| `POST /api/orders` | semua | `{paymentMethod, tendered?, lines[], offlineId?}` → `{receipt}`; `409` + `details[]` bila stok kurang |
| `GET /api/inventory` | semua | → bahan + status + velocity + daysLeft + saran order |
| `POST /api/inventory` | manager+ | `{name, unit, stockQty, lowThreshold, costPerUnit}` |
| `PATCH /api/inventory/:id` | manager+ | `{mode:"restock"\|"set", qty, recordExpense?, expenseAmount?, costPerUnit?, lowThreshold?, name?}` — expense otomatis ke buku kas |
| `GET /api/analytics/summary` | owner+manager | → KPI hari ini, seri 30 hari, per-jam, top produk, split bayar, forecast, order terbaru |
| `GET/POST /api/cash-movements` | owner+manager | buku kas; `{type:"in"\|"out", amount, note}` |
| `POST /api/admin/reseed` | owner | reset data demo |
| `GET /api/health` | publik | → `{ok:true}` bila DB hidup |

---

## 7. Design System

- **Tema**: dark "coal" hangat `#0B0A08` + aksen amber `#F59E0B` / orange `#FB923C`; teks cream `#F5EFE3`, muted sand `#A89A85` — mengurangi kelelahan mata kasir.
- Token di `globals.css` (`@theme`): `coal`, `panel(-2/-3)`, `line(-2)`, `brand`, `glow`, `cream`, `sand`, `faint` + animasi `pulse-soft`, `flicker`.
- Utilitas custom: `.glass`, `.grain` (noise SVG), `.text-glow`, `.btn-press`, `.no-scrollbar`, `.tabular`, `.input-dark`.
- Status stok: emerald (Aman) / amber (Menipis) / red (Habis); severity forecast: red ≤ 2 hari, amber ≤ 5 hari.
- Pola UI: rail kategori 76–92px, kartu produk dengan icon tile warna per produk, sheet konfigurasi varian, modal pembayaran dengan quick-cash presets, drawer riwayat, toast bawah.

---

## 8. Kredensial Demo

| Nama | Peran | PIN | Landing page |
|---|---|---|---|
| Ayu Paramita | Owner | `1234` | `/analytics` |
| Rizky Ramadhan | Manajer | `2468` | `/inventory` |
| Sinta Maharani | Kasir | `1111` | `/pos` |
| Bagas Pratama | Kasir | `3333` | `/pos` |

> Chip "Akses demo" di halaman login bisa diketuk untuk masuk cepat.

---

## 9. Setup Lokal

### 9.1 Prasyarat
- Node.js ≥ 20, PostgreSQL ≥ 14 (default dev: `postgresql://postgres:postgres@127.0.0.1:5432/app_db`).

### 9.2 Langkah
```bash
# 1. Install dependency
npm install

# 2. Siapkan environment (.env)
cat > .env <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
SESSION_SECRET=ganti-dengan-string-acak-panjang-minimal-32-karakter
EOF

# 3. Terapkan schema ke database (tanpa file migrasi)
npx drizzle-kit push

# 4. Jalankan dev server
npm run dev        # http://localhost:3000

# 5. Seed data demo
#    Otomatis berjalan saat login pertama kali — tinggal buka aplikasi
#    dan login dengan PIN 1234 (Owner).
```

### 9.3 Verifikasi (urutan wajib sebelum deploy)
```bash
npx next typegen                       # generate tipe route
npm exec tsc -- --noEmit --pretty false
npm run build                          # production build
```

### 9.4 Uji cepat end-to-end (curl)
```bash
# Login owner
curl -c /tmp/bm.jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"pin":"1234"}'

# Buat order: 2x Kopi Susu (productId 3, variantId 4) + 1 Sirup Vanila (modifierId 3)
curl -b /tmp/bm.jar -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"offlineId":"cek-1","paymentMethod":"cash","tendered":100000,
       "lines":[{"productId":3,"variantId":4,"qty":2,"modifierIds":[3]}]}'
# Kirim persis request yang sama lagi → orderNumber identik (idempotent)

# Lihat prediksi AI
curl -b /tmp/bm.jar http://localhost:3000/api/analytics/summary | jq .forecast

# Reset data demo (owner)
curl -b /tmp/bm.jar -X POST http://localhost:3000/api/admin/reseed
```

---

## 10. Deploy ke Produksi

### Opsi A — Vercel (rekomendasi)
1. Push repo ke GitHub/GitLab → **Import Project** di Vercel (framework: Next.js, auto-detect).
2. Siapkan Postgres terkelola: **Neon / Supabase / Railway / Vercel Postgres**.
3. Set Environment Variables di dashboard Vercel:
   - `DATABASE_URL` = connection string Postgres (aktifkan SSL bila disyaratkan, mis. `?sslmode=require`).
   - `SESSION_SECRET` = string acak ≥ 32 karakter.
4. Terapkan schema ke DB produksi (sekali, dari lokal/CI):
   ```bash
   DATABASE_URL=<prod-url> npx drizzle-kit push
   ```
5. Deploy — build command default `next build` sudah benar. Seed demo berjalan otomatis pada login pertama; reset kapan pun via tombol **Reset Data Demo** di Analytics (owner).
6. Healthcheck: `https://<domain>/api/health` → `{"ok":true}`.

### Opsi B — Node host (VPS / Docker)
```bash
npm ci
npm run build
DATABASE_URL=... npx drizzle-kit push
SESSION_SECRET=... DATABASE_URL=... npm run start   # port 3000
```
Letakkan reverse proxy (Nginx/Caddy) + TLS didepannya. Pool koneksi sudah dibatasi (`max: 10`) dan memakai global memoization agar aman di dev hot-reload.

### Catatan Hardening Produksi
- **Wajib** set `SESSION_SECRET` unik (fallback hanya untuk dev).
- Untuk multi-instance serverless, cache `RecipeIndex` bersifat per-instance — TTL 10 detik sehingga tetap aman.
- Pertimbangkan menambahkan rate-limit sederhana di `/api/auth/login` untuk melawan brute-force PIN.
- Set zona waktu DB/app konsisten bila menjalankan beberapa region (nomor order harian memakai `date_trunc('day', now())` di sisi DB).

---

## 11. Matriks Fitur → Implementasi

| Fitur brief | Status | Lokasi |
|---|---|---|
| Fast-Tap POS (kategori kiri, grid tengah, struk kanan) | ✅ | `app/pos` + `components/pos/*` |
| Dynamic Inventory berbasis resep gram/ml | ✅ | `lib/recipes.ts`, `lib/orders.ts` |
| HPP & profit per transaksi | ✅ | kolom `hpp/profit` di `orders` |
| Dashboard owner real-time (kas masuk/keluar, laba harian/bulanan) | ✅ | `app/analytics` + `api/analytics/summary` |
| Multi-role PIN access | ✅ | `lib/auth.ts`, `AppShell` |
| Low-Stock AI Alert + notifikasi WhatsApp | ✅ | `lib/forecast.ts` + tombol broadcast `wa.me` |
| Offline tolerance + auto-sync | ✅ | `lib/offline.ts`, uji idempotensi terbukti |
| Lisensi jual putus (tanpa SaaS) | ✅ | messaging di login + deployment self-hosted |

### Ide roadmap lanjutan
- CRUD menu/resep dari UI manajer; void/refund order; struk thermal (ESC/POS); WhatsApp otomatis via WA Business API (sekarang deep-link manual); multi-outlet; migrasi offline queue ke Service Worker + IndexedDB untuk PWA penuh; shift/Z-report kasir.

---

*Dokumen ini dibuat setelah seluruh fitur teruji E2E: build ✓, typecheck ✓, potongan stok presisi ✓, idempotensi offline ✓, isolasi role ✓, reseed ✓.*
