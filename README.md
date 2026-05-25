# Monitoring Jaringan ITATS (Nexus)

<div align="center">

![Static Badge](https://img.shields.io/badge/Platform-Web%20%7C%20Android-blue?style=for-the-badge)
![Static Badge](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=nodedotjs)
![Static Badge](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

<img width="800" height="316" alt="Nexus Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

**Sistem Monitoring Jaringan Terintegrasi Kampus ITATS**

Web Admin Portal & Android Mobile Application — Solusi terpusat untuk visualisasi perangkat jaringan (MikroTik), topologi, polling statis, peringatan, dan insight Artificial Intelligence.

</div>

---

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Fitur Lengkap Admin Dashboard](#-fitur-lengkap-admin-dashboard)
  - [Dashboard](#-dashboard)
  - [Campus Map](#-campus-map)
  - [Network Topology](#-network-topology)
  - [Traffic Monitoring (VLAN)](#-traffic-monitoring-vlan)
  - [MikroTik Devices](#-mikrotik-devices)
  - [Access Points](#-access-points)
  - [Clients](#-clients)
  - [Adapters / Controllers](#-adapters--controllers)
  - [System Logs](#-system-logs)
  - [Trouble Reports (Tickets)](#-trouble-reports-tickets)
  - [Notifications](#-notifications)
  - [Smart Central (AI Engine)](#-smart-central-ai-engine)
  - [Settings](#-settings)
- [Public Pages](#-public-pages)
- [Struktur Database](#-struktur-database)
- [Instalasi](#-instalasi)
  - [Setup Database](#setup-database)
  - [Running Development](#running-development)
- [Database Migration](#-database-migration)
- [Export APK Android](#-export-apk-android)
- [Deployment VPS](#-deployment-vps)
- [Troubleshooting](#-troubleshooting)
- [Dokumentasi Tambahan](#-dokumentasi-tambahan)

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **Live Topology** | Memetakan status perangkat (Router / Access Point), VLAN, Adapter Controller langsung dari mesin router via API RouterOS |
| **Real-time Web** | Monitoring langsung dengan visualisasi real-time di browser |
| **Background Telemetry** | Sistem auto-polling berjalan 24/7, menembak request ke MikroTik dan menyimpan telemetri ke MySQL |
| **Telegram Bot** | Notifikasi instan ke channel/private message saat Access Point OFFLINE |
| **JWT Authentication** | Sistem autentikasi ketat dengan JWT expiry check, custom 404 pages, dan auto-logout |
| **Smart Admin Management** | CRUD lengkap dengan OTP Email untuk reset/lupa password |
| **Multi-Platform** | Web production (Express) + Export sebagai APK native Android via Capacitor |
| **AI Prediction** | Prediksi kepadatan jaringan menggunakan TensorFlow.js CNN-1D |
| **Campus Map** | Peta interaktif kampus dengan Leaflet, heat map, dan floor selector |
| **Trouble Ticket System** | Sistem tiket laporan masalah untuk pengguna umum dengan chat discussion |

---

## 📸 Screenshots

> [!NOTE]
> Screenshots akan ditambahkan setelah development selesai. Placeholder berikut menunjukkan struktur yang diharapkan:

| Halaman | Deskripsi |
|---------|-----------|
| Dashboard | Hero stats, density chart, AI predictor, bandwidth widget |
| Campus Map | Peta interaktif dengan marker gedung dan heat map |
| Network Topology | Tree view hierarki perangkat jaringan |
| MikroTik Devices | Interface list dengan live rate monitoring |
| Smart Central | AI engine dashboard dan driver management |

---

## 🛠️ Tech Stack

### Frontend
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) ![Recharts](https://img.shields.io/badge/Recharts-B22A46?style=flat) ![Leaflet](https://img.shields.io/badge/Leaflet-19980A?style=flat&logo=leaflet&logoColor=white)

### Backend & Database
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white) ![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)

### Integrasi & Keamanan
![MikroTik](https://img.shields.io/badge/RouterOS-API-293239?style=flat&logo=mikrotik&logoColor=white) ![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=json-web-tokens&logoColor=white) ![TensorFlow](https://img.shields.io/badge/TensorFlow.js-FF6F00?style=flat&logo=tensorflow&logoColor=white) ![Nodemailer](https://img.shields.io/badge/Nodemailer-22B573?style=flat)

### Mobile
![Capacitor](https://img.shields.io/badge/Capacitor-0096FF?style=flat&logo=capacitor&logoColor=white) ![Android](https://img.shields.io/badge/Android-3DDC84?style=flat&logo=android&logoColor=white)

---

## 📊 Fitur Lengkap Admin Dashboard

### 📈 Dashboard

Halaman utama administrator dengan berbagai widget interaktif:

| Widget | Deskripsi | Auto-refresh |
|--------|-----------|--------------|
| **Hero Stats** | Statistik ringkasan: Wi-Fi Clients aktif, Core Routers online/offline, Access Points | 15 detik |
| **Campus Density Flow Chart** | Grafik area real-time jumlah client wifi per waktu | 15 detik |
| **AI Predictor Widget** | Prediksi kepadatan jaringan (High/Medium/Low) | 15 detik |
| **Live Bandwidth Usage** | Monitoring bandwidth TX/RX per router dan VLAN | 2 detik |
| **Latest Alerts** | List notifikasi terakhir dengan filter tipe | 10 detik |
| **Topology Events Timeline** | Timeline event online/offline Access Points | 15 detik |
| **Customizable Widget Layout** | Toggle tampil/sembunyikan widget | Lokal storage |

> **Tabel Database:** `wifi_density`, `mikrotik_devices`, `mikrotik_aps`, `notifications`, `device_uptime_logs`, `vlan_history`

**Fitur Tambahan Dashboard:**
- Filter per router atau aggregated semua router
- Konfigurasi tampilan bandwidth (text mode / graph mode)
- Filter tipe interface (Ethernet/VLAN/Bridge)
- Ekspor data interface ke CSV

---

### 🗺️ Campus Map

Peta interaktif kampus menggunakan Leaflet:

| Fitur | Deskripsi |
|-------|-----------|
| **Building Explorer Sidebar** | Daftar gedung dengan info kepadatan real-time |
| **Floor Selector** | Pilihan lantai untuk melihat detail ruangan |
| **Heat Map Visualization** | Warna marker berdasarkan kepadatan (Hijau <50%, Kuning 50-80%, Merah >80%) |
| **Map Style Toggle** | Pilihan: Standard OSM atau Dark CartoDB |
| **Room Details Popup** | Detail ruangan: nama, kapasitas, client aktif |
| **Campus Health Widget** | Ringkasan kesehatan WiFi kampus |
| **Density Legend** | Penjelasan threshold warna |

> **Tabel Database:** `mikrotik_devices` (lat, lng), `mikrotik_aps` (lat, lng, last_client_count), `wifi_density`

---

### 🔗 Network Topology

Visualisasi hierarki jaringan:

| Fitur | Deskripsi |
|-------|-----------|
| **Tree View** | Hierarki perangkat berdasarkan level (root → switch → access point) |
| **Real-time Status** | Indikator online/offline per node |
| **Clickable Nodes** | Navigasi ke detail perangkat |
| **Auto-refresh** | Update status otomatis |

> **Tabel Database:** `mikrotik_devices` (level, status, lat, lng), `mikrotik_aps` (status), `network_controllers` (status), `device_uptime_logs`

---

### 📡 Traffic Monitoring (VLAN)

Monitoring trafik VLAN dan interface:

| Fitur | Deskripsi |
|-------|-----------|
| **Interface List** | Daftar semua interface dengan status |
| **Traffic Stats** | Rx/Tx rate per interface |
| **VLAN Breakdown** | Detail trafik per VLAN |
| **Bandwidth Graph** | Grafik real-time penggunaan bandwidth |
| **Type Filters** | Filter: Ethernet, VLAN, Bridge |

> **Tabel Database:** `vlan_history` (rx_byte, tx_byte, vlan_name), `mikrotik_devices` (status)

---

### 🔧 MikroTik Devices

Manajemen lengkap perangkat MikroTik:

| Fitur | Deskripsi |
|-------|-----------|
| **Device CRUD** | Create, Read, Update, Delete perangkat |
| **Interface List & Live Rate** | List interface dengan Tx/Rx rate real-time (2 detik polling) |
| **Bandwidth Management** | Edit Simple Queue limit dan enable/disable queue |
| **Router Terminal** | Eksekusi command RouterOS via API |
| **Quick Commands** | Ping Google, Route Print, Interface Print, System Resource |
| **Driver Selection** | Pilihan protocol: MikroTik API atau SNMP |
| **SNMP Availability Check** | Cek ketersediaan SNMP pada device |
| **CSV Export** | Export data interface ke file CSV |
| **Lat/Long Coordinates** | Koordinat untuk tampilan di peta |

> **Tabel Database:** `mikrotik_devices`, `mikrotik_logs`, `network_controllers`, `system_settings`

**Detail Interface:**
| Kolom | Deskripsi |
|-------|-----------|
| Status | Running/Stopped/Disabled |
| Name | Nama interface |
| Type | ether, vlan, bridge |
| MTU/L2 MTU | Maximum Transmission Unit |
| ↑ Tx | TX Rate real-time |
| ↓ Rx | RX Rate real-time |
| Tx/Rx Packets | Total packet count |
| FP Tx/Rx | FastPath bytes |

---

### 📶 Access Points

Manajemen Access Points dengan fitur lengkap:

| Fitur | Deskripsi |
|-------|-----------|
| **AP CRUD** | Create, Read, Update, Delete Access Points |
| **Filter Options** | Filter by: Type (AP/Backbone), Status (Online/Offline), Router |
| **Pagination** | Navigasi halaman dengan configurable limit (10/25/50/100) |
| **Search** | Pencarian by nama, MAC address, IP, group label |
| **Location Coordinates** | Koordinat untuk tampilan di map |
| **Group/Floor Label** | Label grup atau lantai gedung |

> **Tabel Database:** `mikrotik_aps`, `mikrotik_devices` (FK)

---

### 👥 Clients

Monitoring client WiFi:

| Fitur | Deskripsi |
|-------|-----------|
| **Client Distribution** | Breakdown jumlah client per router |
| **Real-time Count** | Jumlah client aktif |
| **Aggregation View** | Tampilan aggregated di dashboard |

> **Tabel Database:** `wifi_density` (client_count, ap_name), `mikrotik_aps` (last_client_count)

---

### 🔌 Adapters / Controllers

Manajemen adapter multi-vendor:

| Fitur | Deskripsi |
|-------|-----------|
| **Device Driver Manager** | Konfigurasi protocol per device |
| **Driver Selection** | MikroTik API / SNMP |
| **SNMP Status Check** | Indikator ketersediaan SNMP |
| **Test Connection** | Test koneksi ke device |

> **Tabel Database:** `network_controllers`, `system_settings`

---

### 📋 System Logs

Log aktivitas sistem:

| Fitur | Deskripsi |
|-------|-----------|
| **Telemetry Logs** | Log polling device |
| **Activity Logs** | Aktivitas admin |
| **Log Retention** | Konfigurasi masa simpan log |

> **Tabel Database:** `mikrotik_logs`, `device_uptime_logs`, `system_settings` (log_retention_days)

---

### 🎫 Trouble Reports (Tickets)

Sistem tiket laporan masalah:

| Fitur | Deskripsi |
|-------|-----------|
| **Public Ticket Form** | Form pelaporan untuk pengguna umum |
| **Auto-Generate Code** | Kode unik tiket (format: TKT-XXXXX) |
| **Ticket Chat/Discussion** | Diskusi antara pelapor dan admin |
| **Status Tracking** | Open → In Progress → Resolved → Closed |
| **Priority Level** | Low / Medium / High / Critical |
| **Notifications** | Notifikasi saat tiket diupdate |
| **Ticket Search** | Pencarian tiket by code atau nama |

> **Tabel Database:** `tickets`, `ticket_replies`, `notifications`

---

### 🔔 Notifications

Pusat notifikasi lengkap:

| Fitur | Deskripsi |
|-------|-----------|
| **Notification Center** | Daftar lengkap semua notifikasi |
| **Mark as Read** | Tandai sudah dibaca |
| **Mark All Read** | Tandai semua dibaca sekaligus |
| **Delete Notification** | Hapus notifikasi individual |
| **Pagination** | Navigasi halaman |
| **Type Icons** | Info (blue), Warning (amber), Error/Critical (red) |
| **Action URL** | Link langsung ke halaman terkait |

> **Tabel Database:** `notifications`, `system_settings`

**Fitur Notifikasi Tambahan:**
- Real-time toast notification di dashboard
- Push notification via Capacitor (Android)
- Aggregation saat banyak event bersamaan
- Custom notification sounds
- Telegram Bot integration

---

### 🤖 Smart Central (AI Engine)

Dashboard AI dan manajemen adapter:

| Fitur | Deskripsi |
|-------|-----------|
| **TensorFlow.js CNN-1D Model** | Model AI lokal untuk prediksi kepadatan |
| **Traffic Density Prediction** | Prediksi High/Medium/Low per jam |
| **Training Status** | Monitoring status training (Idle/Training) |
| **Training Loss** | Display training loss value |
| **Model Cache** | Cache model untuk optimasi |
| **AI Reset** | Reset cache model |
| **Multi-Vendor Adapter** | Dukungan MikroTik dan SNMP |
| **Driver Switching** | Ganti protocol tanpa restart |
| **Architecture Info** | Info pipeline sistem |

> **Tabel Database:** `wifi_density` (training data), `network_controllers`, `system_settings` (ai_analysis_enabled)

**AI Pipeline:**
```
Network Devices → Adapter Layer → API Server → MySQL → AI Engine → Dashboard
```

---

### ⚙️ Settings

Konfigurasi sistem lengkap dengan 5 tab:

> **Tabel Database:** `system_settings`, `admin_users`, `notifications`, `mikrotik_logs`

#### Tab General
| Setting | Deskripsi |
|---------|-----------|
| Notification Polling | Interval polling notifikasi (detik) |
| Visual Theme | Dark (Deep Space) / Light (Pure Arctic) |

#### Tab Monitoring
| Setting | Deskripsi |
|---------|-----------|
| AI Analysis | Enable/disable prediksi AI |
| Telemetry Retention | Masa simpan log (1-180 hari) |
| Simulation Mode | Mode demo dengan data tiruan |

#### Tab Audio
| Setting | Deskripsi |
|---------|-----------|
| Notification Sounds | Manajemen suara notifikasi kustom |
| Add/Remove Sound | Tambah/hapus suara |
| Set Active | Pilih suara aktif |
| Preview | Preview suara |

#### Tab Integrations
| Setting | Deskripsi |
|---------|-----------|
| Telegram Bot Token | Token bot Telegram |
| Telegram Chat ID | ID chat/channel tujuan |
| Backend Server URL | URL untuk koneksi mobile APK |

#### Tab Security
| Setting | Deskripsi |
|---------|-----------|
| Admin Users CRUD | Kelola admin: Add, Edit, Delete, Toggle Active |
| Role Management | Admin (Full Access) / Viewer (Read Only) |
| Change Password | Ubah password sendiri |
| OTP Password Reset | Reset via email OTP |
| Flush Notifications | Hapus semua notifikasi |
| Flush Logs | Hapus semua log telemetri |

---

## 🌐 Public Pages

Halaman publik yang dapat diakses tanpa login:

| Halaman | Route | Deskripsi |
|---------|-------|-----------|
| **Public Map** | `/` | Peta kampus publik dengan info kepadatan |
| **Report Form** | `/report` | Form pelaporan masalah untuk pengguna umum |
| **Status Board** | `/status-board` | Display status board untuk TV/monitor |
| **Ticket Chat** | `/ticket/:code` | Halaman diskusi tiket |

---

## 🗄️ Struktur Database

Sistem menggunakan 14 tabel database dengan relasi sebagai berikut:

### Daftar Tabel

| No | Nama Tabel | Deskripsi | Tabel Utama |
|----|------------|-----------|-------------|
| 1 | `admin_users` | Data administrator sistem | Autentikasi |
| 2 | `password_reset_tokens` | Token reset password | Autentikasi |
| 3 | `system_settings` | Konfigurasi sistem | Sistem |
| 4 | `mikrotik_devices` | Data perangkat MikroTik | Monitoring |
| 5 | `mikrotik_aps` | Data Access Point | Monitoring |
| 6 | `wifi_density` | Data kepadatan WiFi | Monitoring |
| 7 | `notifications` | Notifikasi sistem | Notifikasi |
| 8 | `vlan_history` | History trafik VLAN | Monitoring |
| 9 | `mikrotik_logs` | Log telemetri MikroTik | Monitoring |
| 10 | `device_uptime_logs` | Log uptime device | Monitoring |
| 11 | `network_controllers` | Adapter multi-vendor | Monitoring |
| 12 | `tickets` | Tiket laporan masalah | Tiket |
| 13 | `ticket_replies` | Reply/diskusi tiket | Tiket |
| 14 | `migrations_history` | Track executed migrations | Sistem |

### Relasi Antar Tabel

```
admin_users ───┬─── password_reset_tokens
               │
               └─── tickets ─── ticket_replies
                               │
mikrotik_devices ──┬─── mikrotik_aps ─── wifi_density
                   ├─── vlan_history
                   └─── mikrotik_logs
                   │
                   └─── device_uptime_logs
                   │
network_controllers
```

---

## 🚀 Instalasi (Local Development)

> **Catatan:** Semua proses development berada di dalam satu folder repository (Monorepo).

### 1. Prasyarat Sistem

- **Node.js** — Minimal versi 18 atau ke atas ([Download](https://nodejs.org/))
- **Database Server** — MySQL (Disarankan [Laragon](https://laragon.org/), [XAMPP](https://www.apachefriends.org/), atau DB Desktop sejenis)

### 2. Setup Modul

Buka repository ini, lalu buka terminal untuk menginstal seluruh package:

```bash
npm install
```

### 3. Konfigurasi Environment Variable

Buat atau konfigurasi file `.env` di folder root:

```env
# ===================
# Koneksi Database
# ===================
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_USER="root"
DB_PASS=""
DB_NAME="wifi_itats.db"

# ===================
# Mode Simulasi
# ===================
MIKROTIK_SIMULATION_MODE="false"

# ===================
# Pengaturan SMTP (Recovery Password)
# Pakai Gmail App Password
# ===================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="<email_anda>@gmail.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"
SMTP_FROM_NAME="Monitoring Jaringan ITATS"
SMTP_RESET_EMAIL="<email_anda>@gmail.com"

# ===================
# Pengaturan Mobile / Capacitor
# PENTING: Saat development, ganti IP dengan IP LOKAL
# koneksi internet laptop Anda (bukan localhost)
# agar APK di HP bisa mengakses API
# ===================
VITE_API_URL="http://192.168.1.x:3000"
```

### 4. Setup Database

Database akan otomatis dibuat dan di-migrate saat pertama kali running. Namun, kamu juga bisa menjalankan migration secara manual:

```bash
# Jalankan semua migration
npm run migrate

# Cek status migration
npm run migrate:status

# Rollback migration terakhir
npm run migrate:rollback

# Reset semua tabel (hati-hati!)
npm run migrate:reset
```

### 5. Running Project

```bash
npm run dev
```

Lalu buka [http://localhost:3000](http://localhost:3000)

> **Default Login Test:**
> - Username: `admin`
> - Password: `admin123`

---

## 🗄️ Database Migration

Sistem menggunakan sistem migration berbasis CLI (mirip Laravel Artisan) untuk manajemen database.

### Perintah Migration

| Perintah | Fungsi |
|----------|--------|
| `npm run migrate` | Jalankan semua migration yang belum berjalan |
| `npm run migrate:status` | Lihat status semua migration |
| `npm run migrate:rollback` | Rollback migration terakhir |
| `npm run migrate:reset` | Drop semua tabel (butuh konfirmasi) |

### Daftar Migration

| ID | Nama | Deskripsi |
|----|------|-----------|
| 001 | `create_admin_users` | Tabel administrator sistem |
| 002 | `create_password_reset_tokens` | Token reset password |
| 003 | `create_system_settings` | Konfigurasi sistem |
| 004 | `create_mikrotik_devices` | Data perangkat MikroTik |
| 005 | `create_mikrotik_aps` | Data Access Point |
| 006 | `create_wifi_density` | Data kepadatan WiFi |
| 007 | `create_notifications` | Notifikasi sistem |
| 008 | `create_vlan_history` | History trafik VLAN |
| 009 | `create_mikrotik_logs` | Log telemetri MikroTik |
| 010 | `create_device_uptime_logs` | Log uptime device |
| 011 | `create_network_controllers` | Adapter multi-vendor |
| 012 | `create_tickets` | Tiket laporan masalah |
| 013 | `create_ticket_replies` | Reply/diskusi tiket |
| 014 | `seed_default_data` | Data default (admin, settings) |

### Status Migration

```
┌──────┬────────────────────────────────────────────┬───────────┐
│ ID   │ Migration Name                            │ Status    │
├──────┼────────────────────────────────────────────┼───────────┤
│    1 │ Create admin_users table                     │ ✅ Done  │
│    2 │ Create password_reset_tokens table           │ ✅ Done  │
│    3 │ Create system_settings table                 │ ✅ Done  │
│    4 │ Create mikrotik_devices table                │ ✅ Done  │
│    5 │ Create mikrotik_aps table                    │ ✅ Done  │
│    6 │ Create wifi_density table                    │ ✅ Done  │
│    7 │ Create notifications table                   │ ✅ Done  │
│    8 │ Create vlan_history table                    │ ✅ Done  │
│    9 │ Create mikrotik_logs table                   │ ✅ Done  │
│   10 │ Create device_uptime_logs table              │ ✅ Done  │
│   11 │ Create network_controllers table             │ ✅ Done  │
│   12 │ Create tickets table                         │ ✅ Done  │
│   13 │ Create ticket_replies table                  │ ✅ Done  │
│   14 │ Seed default data                            │ ✅ Done  │
└──────┴────────────────────────────────────────────┴───────────┘
```

### Struktur File Migration

```
migrations/
├── index.ts                    # Registry semua migration
├── 001_create_admin_users.ts
├── 002_create_password_reset_tokens.ts
├── 003_create_system_settings.ts
├── 004_create_mikrotik_devices.ts
├── 005_create_mikrotik_aps.ts
├── 006_create_wifi_density.ts
├── 007_create_notifications.ts
├── 008_create_vlan_history.ts
├── 009_create_mikrotik_logs.ts
├── 010_create_device_uptime_logs.ts
├── 011_create_network_controllers.ts
├── 012_create_tickets.ts
├── 013_create_ticket_replies.ts
└── 014_seed_default_data.ts
```

---

## 📱 Export APK Android (Capacitor)

Arsitektur sudah tersedia, ubah menjadi aplikasi native HP sangat cepat!

### Langkah 1: Build React App

```bash
npm run build
```

### Langkah 2: Ganti Asset Icon (Opsional)

```bash
npx @capacitor/assets generate --android
```

### Langkah 3: Sync dengan Capacitor

```bash
npx cap sync android
```

### Langkah 4: Buka di Android Studio

```bash
npx cap open android
```

Tunggu indikator Gradle selesai, lalu tekan **Run (Play)** untuk emulator atau **Build APK** untuk install di HP.

> ⚠️ **PENTING:** APK yang dirilis WAJIB terhubung ke wifi yang merujuk ke `VITE_API_URL` yang diset saat build. Selama laptop (server) mati, HP tidak bisa mengakses data.

---

## 🌐 Deployment VPS (Production)

Panduan lengkap deployment ke Virtual Private Server (Ubuntu / Debian).

### Tahap 1: Persiapan Server

Pastikan VPS baru dan akses via SSH, lalu jalankan:

```bash
# 1. Update Server
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js v18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Nginx (Web Server Proxy)
sudo apt install nginx -y

# 4. Install PM2 (Process Manager agar Node.js nyala 24/7)
sudo npm install -g pm2

# 5. Install MySQL Server
sudo apt install mysql-server -y
```

### Tahap 2: Konfigurasi Database

Buat user dan database untuk sistem:

```bash
sudo mysql
```

Jalankan query di MySQL Shell:

```sql
CREATE DATABASE wifi_itats_db;
CREATE USER 'admin_itats'@'localhost' IDENTIFIED BY 'PasswordKuat123!';
GRANT ALL PRIVILEGES ON wifi_itats_db.* TO 'admin_itats'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Tahap 3: Upload dan Build Aplikasi

1. Pindahkan folder project ke VPS (misalnya ke `/var/www/monitoring-jaringan-itats`)
2. Masuk ke folder project:

```bash
cd /var/www/monitoring-jaringan-itats
```

3. Install package dan konfigurasi `.env`:

```bash
npm install
nano .env
```

4. Build aplikasi:

```bash
npm run build
```

### Tahap 4: Menjalankan Backend 24/7 dengan PM2

```bash
# Jalankan API dengan PM2
pm2 start npx --name "nexus-api" -- tsx server/index.ts

# Set auto-start saat server reboot
pm2 startup
pm2 save
```

> ℹ️ Server sekarang berjalan di `http://127.0.0.1:3000`

### Tahap 5: Konfigurasi Domain & Nginx Proxy

Arahkan domain (contoh: `monitoring.itats.ac.id`) menggunakan reverse-proxy Nginx:

1. Buat config Nginx:

```bash
sudo nano /etc/nginx/sites-available/nexus
```

2. Isi config (ganti dengan domain/IP Anda):

```nginx
server {
    listen 80;
    server_name monitoring.itats.ac.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Aktifkan dan restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Tahap 6 (Opsional): SSL & HTTPS

Instal Certbot (Let's Encrypt) untuk HTTPS:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d monitoring.itats.ac.id
```

> ✨ Voila! Hosting selesai dan Server Nexus memonitor ratusan switch kampus Anda!

---

## ⚡ Troubleshooting

### Gitignore tidak Berfungsi?

Jika Anda baru mengubah aturan `.gitignore` namun file sudah ter-commit sebelumnya, Git tetap melacaknya.

Untuk memaksa Git "melupakan" file tersebut:

```bash
git rm -r --cached .
git add .
git commit -m "chore: apply new .gitignore rules and clear cache"
```

---

## 📚 Dokumentasi Tambahan

| Dokumen | Lokasi | Deskripsi |
|---------|--------|-----------|
| **Proposal Skripsi Bab 3** | [PROPOSAL-BAB3.md](./PROPOSAL-BAB3.md) | Metode penelitian dan spesifikasi teknis lengkap |
| **API Documentation** | `/server/docs/` | Dokumentasi endpoint API |
| **Database Schema** | `/server/schema/` | SQL schema dan migrations |

---

## 📄 Lisensi

MIT License — © 2026 Administrator Portal Nexus - ITATS Monitoring Group.
