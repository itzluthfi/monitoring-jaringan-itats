# BAB III
# METODE PENELITIAN

---

## 3.1 Jenis dan Pendekatan Penelitian

Penelitian ini menggunakan **metode Penelitian dan Pengembangan** (*Research and Development*) yang bertujuan untuk menghasilkan suatu produk perangkat lunak berupa sistem monitoring jaringan terintegrasi. Pengembangan sistem dilakukan dengan pendekatan **Waterfall** yang dimodifikasi, dimulai dari tahap analisis kebutuhan hingga tahap implementasi dan pengujian.

Pendekatan yang digunakan adalah **SDLC (System Development Life Cycle)** dengan tahapan sebagai berikut:

1. **Analisis Kebutuhan** (*Requirement Analysis*)
2. **Perancangan Sistem** (*System Design*)
3. **Implementasi** (*Implementation*)
4. **Pengujian** (*Testing*)
5. **Deploymen** (*Deployment*)
6. **Pemeliharaan** (*Maintenance*)

---

## 3.2 Prosedur Penelitian

Prosedur penelitian yang digunakan dalam pengembangan sistem ini adalah sebagai berikut:

### 3.2.1 Tahap Persiapan dan Analisis Kebutuhan

Pada tahap ini, peneliti melakukan serangkaian kegiatan untuk memahami kondisi eksisting dan menentukan kebutuhan sistem yang akan dikembangkan:

1. **Studi Literatur**
   - Mempelajari literatur mengenai sistem monitoring jaringan
   - Mengkaji penelitian terdahulu yang relevan
   - Memahami teknologi MikroTik RouterOS API dan SNMP

2. **Observasi Lapangan**
   - Mengamati infrastruktur jaringan di Kampus ITATS
   - Mengidentifikasi perangkat jaringan yang digunakan (MikroTik Router, Access Point, Switch)
   - Menganalisis pola traffik dan kebutuhan monitoring

3. **Wawancara**
   - Berdiskusi dengan Administrator jaringan Kampus ITATS
   - Mengidentifikasi permasalahan yang dihadapi dalam monitoring jaringan
   - Mendapatkan requirements langsung dari pengguna potensial

4. **Pengumpulan Kebutuhan**
   - Kebutuhan Fungsional:
     - Monitoring status perangkat jaringan secara real-time
     - Visualisasi topologi jaringan
     - Notifikasi otomatis saat perangkat offline
     - Analisis kepadatan jaringan dengan AI
     - Dashboard untuk administrator
   - Kebutuhan Non-Fungsional:
     - Sistem harus responsif (mobile-friendly)
     - Waktu respons API kurang dari 2 detik
     - Data telemetri tersimpan minimal 30 hari

### 3.2.2 Tahap Perancangan Sistem

1. **Perancangan Arsitektur Sistem**
   - Arsitektur **Client-Server** dengan REST API
   - Arsitektur **Microservices** untuk worker background
   - Database **MySQL** untuk penyimpanan data terpusat

2. **Perancangan Database**
   - Diagram Entity Relationship (ERD)
   - Normalisasi database hingga bentuk 3NF
   - Perancangan tabel: `mikrotiks`, `access_points`, `notifications`, `admins`, `settings`, `tickets`, `logs`

3. **Perancangan Antarmuka (UI/UX)**
   - Wireframe untuk setiap halaman
   - Desain sistem warna dark theme
   - Responsive layout untuk desktop dan mobile
   - User flow untuk setiap fitur

4. **Perancangan API**
   - Endpoint untuk setiap modul
   - Format request dan response (JSON)
   - Autentikasi menggunakan JWT Token
   - Rate limiting dan error handling

### 3.2.3 Tahap Implementasi

Implementasi sistem dilakukan dengan membagi开发 menjadi beberapa modul utama:

#### a. **Modul Backend (Node.js + Express)**
   - Authentication module (Login, JWT, OTP)
   - MikroTik API integration module
   - SNMP polling module
   - Background worker (cron job)
   - Telegram bot integration
   - Notification system
   - AI Engine (TensorFlow.js)

#### b. **Modul Frontend (React + Vite)**
   - Dashboard module
   - Topology visualization module
   - Campus map module (Leaflet)
   - Device management module
   - Settings module
   - Notifications module

#### c. **Modul Mobile (Capacitor)**
   - Web app wrapper untuk Android APK
   - Local notifications integration
   - Capacitor native plugins

### 3.2.4 Tahap Pengujian

Pengujian sistem dilakukan menggunakan beberapa metode:

1. **Black Box Testing**
   - Pengujian semua fitur fungsional
   - Pengujian form input dan validasi
   - Pengujian navigasi antar halaman

2. **White Box Testing**
   - Pengujian unit pada setiap fungsi backend
   - Pengujian integrasi API endpoint
   - Pengujian query database

3. **User Acceptance Testing (UAT)**
   - Pengujian oleh Administrator jaringan ITATS
   - Pengujian responsivitas pada berbagai device
   - Pengujian performa dan beban sistem

4. **Performance Testing**
   - Pengujian waktu respons API
   - Pengujian concurrent users
   - Pengujian resource usage server

---

## 3.3 Kebutuhan Sistem (Requirements)

### 3.3.1 Kebutuhan Hardware

| Komponen | Spesifikasi Minimal | Keterangan |
|----------|---------------------|------------|
| **Server** | CPU 2 core, RAM 4GB, Storage 50GB | Untuk backend API dan database |
| **Database** | MySQL 5.7+ atau MariaDB 10.3+ | Penyimpanan data terpusat |
| **Perangkat Jaringan** | MikroTik RouterOS v6/v7 | Target monitoring |
| **Client PC** | Browser modern (Chrome/Firefox/Edge) | Akses web admin |
| **Mobile Device** | Android 6.0+ | Untuk aplikasi APK |

### 3.3.2 Kebutuhan Software

| Komponen | Spesifikasi | Keterangan |
|----------|-------------|------------|
| **Node.js** | v18+ | Runtime backend |
| **NPM** | v8+ | Package manager |
| **MySQL** | v5.7+ | Database server |
| **Laragon/XAMPP** | Latest | Local development (opsional) |
| **Android Studio** | Latest | Build APK (opsional) |
| **Vite** | v5+ | Frontend build tool |
| **React** | v18+ | Frontend framework |
| **Tailwind CSS** | v3+ | Styling framework |

### 3.3.3 Kebutuhan Konektivitas

- Server backend harus dapat diakses oleh perangkat client via jaringan lokal
- API Router MikroTik harus dapat dijangkau dari server backend (port 8728)
- SNMP devices harus dapat dijangkau via port UDP 161
- Koneksi internet untuk notifikasi Telegram (opsional)

---

## 3.4 Alur Kerja Sistem (System Flow)

### 3.4.1 Arsitektur Sistem Keseluruhan

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          NEXUS MONITORING SYSTEM                         │
│                                                                         │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐│
│  │   MikroTik       │     │   MikroTik       │     │   MikroTik       ││
│  │   Router 1       │     │   Router 2       │     │   Router N       ││
│  │   (API :8728)    │     │   (API :8728)    │     │   (API :8728)    ││
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘│
│           │                       │                       │          │
│           │     SNMP / API        │                       │          │
│           ▼                       ▼                       ▼          │
│  ┌───────────────────────────────────────────────────────────────────┐│
│  │                    BACKEND SERVER (Node.js)                     ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             ││
│  │  │  REST API   │  │  Telemetry  │  │    AI       │             ││
│  │  │  Express    │  │  Worker     │  │  Engine     │             ││
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             ││
│  │         │                │                │                     ││
│  │         └────────────────┼────────────────┘                     ││
│  │                          │                                      ││
│  │                    ┌─────▼─────┐                                 ││
│  │                    │  MySQL    │                                 ││
│  │                    │  Database │                                 ││
│  │                    └───────────┘                                 ││
│  └───────────────────────────────────────────────────────────────────┘│
│                    │                    │                              │
│                    │   REST API        │   Telegram Bot              │
│                    ▼                    ▼                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐│
│  │   Web Admin      │     │   Android APK    │     │   Telegram       ││
│  │   Dashboard      │     │   (Capacitor)    │     │   Notifications ││
│  │   (React+Vite)   │     │                  │     │                  ││
│  └──────────────────┘     └──────────────────┘     └──────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4.2 Diagram Alir Monitoring Device

```
MULAI
  │
  ▼
┌─────────────────────┐
│ Inisialisasi Sistem │
│ & Koneksi Database  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Start Cron Job       │
│ (Polling Interval)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     TIDAK      ┌─────────────────────┐
│ Cek Simulation      ├───────────────►│ Ambil Data dari      │
│ Mode Active?        │               │ MikroTik API/SNMP   │
└─────────┬───────────┘               └─────────┬───────────┘
          │                                       │
          YA                                      │
          │                                       ▼
          ▼                              ┌─────────────────────┐
┌─────────────────────┐                 │ Parse Response     │
│ Generate Simulated  │                 │ & Extract Metrics   │
│ Data (Demo)         │                 └─────────┬───────────┘
└─────────┬───────────┘                           │
          │                                       ▼
          └───────────────────┬─────────────────┐
                              │                 │
                              ▼                 ▼
                    ┌─────────────────────┐  ┌─────────────────────┐
                    │ Save to Database    │  │ Cek Status Device   │
                    │ (MySQL)             │  │ (Online/Offline)    │
                    └─────────┬───────────┘  └─────────┬───────────┘
                              │                        │
                              ▼                        ▼
                    ┌─────────────────────┐  ┌─────────────────────┐
                    │ Trigger Notification │  │ Jika Offline:       │
                    │ (Toast/Telegram)    │  │ Insert Alert Log    │
                    └─────────┬───────────┘  └─────────┬───────────┘
                              │                        │
                              └────────────────────────┬┘
                                                   ▼
                                        ┌─────────────────────┐
                                        │ Update Dashboard    │
                                        │ & AI Prediction     │
                                        └─────────┬───────────┘
                                                  │
                                                  ▼
                                        ┌─────────────────────┐
                                        │ Simpan Historical    │
                                        │ Data untuk ML        │
                                        └─────────┬───────────┘
                                                  │
                                                  ▼
                                        ┌─────────────────────┐
                                        │ Job Selesai, Tunggu │
                                        │ Interval Berikutnya │
                                        └─────────────────────┘
```

### 3.4.3 Diagram Alir Login & Autentikasi

```
┌─────────────┐
│  LOGIN     │
│   PAGE     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Input Username &    │
│ Password            │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     TIDAK      ┌─────────────────────┐
│ Validasi Credential │◄───────────────│ Tampilkan Error     │
│ di Database         │               │ "Invalid Login"     │
└─────────┬───────────┘               └─────────────────────┘
          │
          YA
          │
          ▼
┌─────────────────────┐
│ Generate JWT Token  │
│ + Expired Time     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Return Token to     │
│ Client (LocalStorage)│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Redirect ke         │
│ Dashboard           │
└─────────────────────┘
```

### 3.4.4 Diagram Alir OTP Password Reset

```
┌─────────────────────┐
│ User Klik           │
│ "Lupa Password"     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Input Username      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     TIDAK      ┌─────────────────────┐
│ Cek Username ada    │◄───────────────│ "User tidak found"  │
│ di Database?       │               └─────────────────────┘
└─────────┬───────────┘
          │
          YA
          │
          ▼
┌─────────────────────┐
│ Generate 6-digit    │
│ OTP Code           │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Send OTP via        │
│ Email (Nodemailer) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ User Input OTP +    │
│ Password Baru       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     TIDAK      ┌─────────────────────┐
│ Validasi OTP        │◄───────────────│ "OTP Invalid/Expired"│
│ (6 digit, 5 menit) │               └─────────────────────┘
└─────────┬───────────┘
          │
          YA
          │
          ▼
┌─────────────────────┐
│ Update Password     │
│ (Hash + Bcrypt)     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Return to Login     │
│ Page (Success)      │
└─────────────────────┘
```

---

## 3.5 Perancangan Basis Data (Database Design)

### 3.5.1 Daftar Tabel Database

Sistem menggunakan 14 tabel database untuk menyimpan data monitoring jaringan:

| No | Nama Tabel | Deskripsi | Relasi |
|----|------------|-----------|--------|
| 1 | `admin_users` | Data administrator sistem | - |
| 2 | `password_reset_tokens` | Token reset password | FK → admin_users |
| 3 | `system_settings` | Konfigurasi sistem | - |
| 4 | `mikrotik_devices` | Data perangkat MikroTik | - |
| 5 | `mikrotik_aps` | Data Access Point | FK → mikrotik_devices |
| 6 | `wifi_density` | Data kepadatan WiFi | - |
| 7 | `notifications` | Notifikasi sistem | - |
| 8 | `vlan_history` | History trafik VLAN | FK → mikrotik_devices |
| 9 | `mikrotik_logs` | Log telemetri MikroTik | FK → mikrotik_devices |
| 10 | `device_uptime_logs` | Log uptime device | - |
| 11 | `network_controllers` | Adapter multi-vendor | - |
| 12 | `tickets` | Tiket laporan masalah | - |
| 13 | `ticket_replies` | Reply/diskusi tiket | FK → tickets |
| 14 | `migrations_history` | Track executed migrations | - |

### 3.5.2 Entity Relationship Diagram (ERD)

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    ADMINS       │         │    SETTINGS     │         │  NOTIFICATIONS  │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id (PK)         │         │ id (PK)         │         │ id (PK)         │
│ username        │         │ key             │         │ type            │
│ password        │         │ value           │         │ title           │
│ email           │         │ created_at      │         │ message         │
│ role            │         │ updated_at      │         │ is_read         │
│ is_active       │         └─────────────────┘         │ action_url      │
│ last_login      │                                        │ created_at      │
│ created_at      │                                        └────────┬────────┘
└─────────────────┘                                                 │
        │                                                           │
        │                          ┌─────────────────────────────────┘
        │                          │
        ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             MIKROTIKS                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ id (PK)                     │ Interface: 1-N                            │
│ name                        ├─────────────────────────────────────────────┤
│ host                        │ .id (PK)                                   │
│ port                        │ mikrotik_id (FK)                           │
│ user                        │ name                                       │
│ password                    │ type                                       │
│ driver                      │ status                                     │
│ status                      │ tx-byte, rx-byte                           │
│ lat                         │ tx-rate, rx-rate                           │
│ lng                         │ disabled                                   │
│ level                       │ running                                    │
│ snmp_community              │ parent                                     │
│ snmp_port                   │ created_at                                 │
│ created_at                   └─────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│       SIMPLE_QUEUES                 │  │       ACCESS_POINTS                   │
├─────────────────────────────────────┤  ├─────────────────────────────────────┤
│ id (PK)                             │  │ id (PK)                              │
│ mikrotik_id (FK)                    │  │ mikrotik_id (FK)                     │
│ name                                │  │ name                                 │
│ target                              │  │ ip_address                           │
│ max_limit                           │  │ mac_address                          │
│ rx_byte                             │  │ group_label                          │
│ tx_byte                             │  │ mode                                 │
│ disabled                            │  │ status                               │
│ created_at                          │  │ lat                                  │
└─────────────────────────────────────┘  │ lng                                  │
                                          │ last_error                           │
                                          │ created_at                           │
                                          └─────────────────────────────────────┘
                                                 │
                                                 │
                                                 ▼
                                  ┌───────────────────────────┐
                                  │      TICKETS              │
                                  ├───────────────────────────┤
                                  │ id (PK)                   │
                                  │ code                      │
                                  │ reporter_name             │
                                  │ reporter_contact          │
                                  │ title                     │
                                  │ description               │
                                  │ status                    │
                                  │ priority                  │
                                  │ created_at                │
                                  │ updated_at               │
                                  └───────────────────────────┘
```

### 3.5.3 Spesifikasi Tabel Database

#### Tabel `admins`

| Field | Type | Constraint | Deskripsi |
|-------|------|------------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID Admin |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Username login |
| password | VARCHAR(255) | NOT NULL | Password hash (bcrypt) |
| email | VARCHAR(100) | NULL | Email untuk OTP |
| role | ENUM('admin','viewer') | DEFAULT 'admin' | Role pengguna |
| is_active | TINYINT(1) | DEFAULT 1 | Status aktif |
| last_login | DATETIME | NULL | Login terakhir |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Tanggal dibuat |

#### Tabel `mikrotiks`

| Field | Type | Constraint | Deskripsi |
|-------|------|------------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID Router |
| name | VARCHAR(100) | NOT NULL | Nama router |
| host | VARCHAR(100) | NOT NULL | IP/hostname |
| port | INT | DEFAULT 8728 | Port API |
| user | VARCHAR(50) | NOT NULL | Username router |
| password | VARCHAR(255) | NOT NULL | Password hash |
| driver | ENUM('mikrotik','snmp') | DEFAULT 'mikrotik' | Protocol driver |
| status | ENUM('online','offline') | DEFAULT 'offline' | Status polling |
| lat | DECIMAL(10,8) | NULL | Latitude peta |
| lng | DECIMAL(11,8) | NULL | Longitude peta |
| level | INT | DEFAULT 0 | Level topology |
| snmp_community | VARCHAR(50) | DEFAULT 'public' | SNMP community |
| snmp_port | INT | DEFAULT 161 | SNMP port |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Tanggal dibuat |

#### Tabel `access_points`

| Field | Type | Constraint | Deskripsi |
|-------|------|------------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID Access Point |
| mikrotik_id | INT | FK -> mikrotiks.id | Router induk |
| name | VARCHAR(100) | NOT NULL | Nama AP |
| ip_address | VARCHAR(45) | NULL | IP address |
| mac_address | VARCHAR(17) | NULL | MAC address |
| group_label | VARCHAR(100) | NULL | Label grup/lantai |
| mode | ENUM('ap','infrastructure') | DEFAULT 'ap' | Tipe AP |
| status | ENUM('online','offline') | DEFAULT 'offline' | Status polling |
| lat | DECIMAL(10,8) | NULL | Latitude |
| lng | DECIMAL(11,8) | NULL | Longitude |
| last_error | TEXT | NULL | Error terakhir |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Tanggal dibuat |

#### Tabel `notifications`

| Field | Type | Constraint | Deskripsi |
|-------|------|------------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID Notifikasi |
| type | ENUM('info','warning','error','critical') | DEFAULT 'info' | Tipe notifikasi |
| title | VARCHAR(200) | NOT NULL | Judul |
| message | TEXT | NOT NULL | Isi pesan |
| is_read | TINYINT(1) | DEFAULT 0 | Status dibaca |
| action_url | VARCHAR(255) | NULL | URL aksi |
| device_id | INT | NULL | Device terkait |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Tanggal dibuat |

#### Tabel `settings`

| Field | Type | Constraint | Deskripsi |
|-------|------|------------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID Setting |
| key | VARCHAR(100) | UNIQUE, NOT NULL | Key setting |
| value | TEXT | NULL | Value setting |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | Update terakhir |

#### Tabel `tickets`

| Field | Type | Constraint | Deskripsi |
|-------|------|------------|-----------|
| id | INT | PK, AUTO_INCREMENT | ID Tiket |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Kode unik tiket |
| reporter_name | VARCHAR(100) | NOT NULL | Nama pelapor |
| reporter_contact | VARCHAR(100) | NULL | Kontak pelapor |
| title | VARCHAR(200) | NOT NULL | Judul masalah |
| description | TEXT | NOT NULL | Deskripsi masalah |
| status | ENUM('open','in_progress','resolved','closed') | DEFAULT 'open' | Status |
| priority | ENUM('low','medium','high','critical') | DEFAULT 'medium' | Prioritas |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Tanggal dibuat |
| updated_at | DATETIME | ON UPDATE CURRENT_TIMESTAMP | Update terakhir |

---

## 3.6 Spesifikasi Fitur Sistem

### 3.6.1 Fitur Dashboard Administrator

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Hero Stats Cards | Menampilkan statistik ringkasan: Wi-Fi Clients aktif, Core Routers online/offline, Access Points online/offline |
| 2 | Campus Density Chart | Grafik area real-time jumlah client wifi per waktu (Auto-refresh 15 detik) |
| 3 | AI Predictor Widget | Prediksi kepadatan jaringan menggunakan TensorFlow.js CNN-1D |
| 4 | Live Bandwidth Usage | Monitoring bandwidth TX/RX per router dan VLAN secara live |
| 5 | Latest Alerts Widget | List notifikasi terakhir dengan filter tipe (info/warning/error) |
| 6 | Topology Events Timeline | Timeline event online/offline Access Points |
| 7 | Customizable Widget Layout | Toggle tampil/sembunyikan widget sesuai preferensi admin |

### 3.6.2 Fitur Monitoring Perangkat

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | MikroTik Devices CRUD | Create, Read, Update, Delete perangkat MikroTik |
| 2 | Interface List & Live Rate | List semua interface dengan Tx/Rx rate real-time |
| 3 | Bandwidth Management | Edit Simple Queue limit dan enable/disable queue |
| 4 | Router Terminal | Eksekusi command RouterOS via API (Ping, Route Print, dll) |
| 5 | Driver Selection | Pilihan protocol: MikroTik API atau SNMP |
| 6 | CSV Export | Export data interface ke file CSV |
| 7 | Access Points CRUD | Manajemen Access Point dengan filter dan pagination |
| 8 | SNMP Availability Check | Cek ketersediaan SNMP pada device |

### 3.6.3 Fitur Visualisasi Jaringan

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Campus Map (Leaflet) | Peta interaktif kampus dengan marker bangunan |
| 2 | Building Explorer | Sidebar daftar gedung dengan info kepadatan |
| 3 | Floor Selector | Pilihan lantai untuk melihat room details |
| 4 | Heat Map Visualization | Warna marker berdasarkan tingkat kepadatan (Hijau/Kuning/Merah) |
| 5 | Map Style Toggle | Pilihan style peta: Standard OSM atau Dark CartoDB |
| 6 | Network Topology View | Tree view topologi jaringan berdasarkan hierarki device |

### 3.6.4 Fitur Notifikasi & Alerting

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Real-time Toast Notifications | Popup notifikasi di dashboard saat ada event |
| 2 | Telegram Bot Integration | Kirim alert ke channel/grup Telegram |
| 3 | Notification Center | Daftar lengkap notifikasi dengan pagination |
| 4 | Multiple Events Aggregation | Grouping notifikasi saat banyak event bersamaan |
| 5 | Push Notifications (Mobile) | Native push notification via Capacitor |
| 6 | Custom Notification Sounds | Konfigurasi suara notifikasi kustom |
| 7 | Mark Read / Delete | Manajemen notifikasi |

### 3.6.5 Fitur Keamanan & Autentikasi

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | JWT Authentication | Login dengan JWT token (expiry check client-side) |
| 2 | Auto-Logout | Logout otomatis saat token expired |
| 3 | Custom 404 Pages | Halaman error kustom |
| 4 | Admin Management CRUD | Create, Update, Delete admin users |
| 5 | Role-Based Access (Admin/Viewer) | Pembatasan akses berdasarkan role |
| 6 | Password Change | Ubah password dengan validasi |
| 7 | OTP Password Reset | Reset password via kode OTP ke email |

### 3.6.6 Fitur AI Engine (Smart Central)

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | TensorFlow.js CNN-1D Model | Model AI lokal untuk prediksi kepadatan |
| 2 | Traffic Density Prediction | Prediksi jam sibuk kepadatan jaringan |
| 3 | Multi-Vendor Adapter | Dukungan device MikroTik dan SNMP |
| 4 | Driver Switching | Ganti protocol driver tanpa restart |
| 5 | AI Cache Management | Reset cache model AI |
| 6 | Training Loss Monitoring | Monitoring status training model |

### 3.6.7 Fitur Trouble Ticket System

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Public Ticket Form | Form pelaporan masalah untuk pengguna umum |
| 2 | Ticket Auto-Generate Code | Generate kode unik tiket secara otomatis |
| 3 | Ticket Chat/Discussion | Diskusi between reporter dan admin |
| 4 | Status Tracking | Tracking status tiket (Open/In Progress/Resolved/Closed) |
| 5 | Priority Level | Level prioritas (Low/Medium/High/Critical) |
| 6 | Notification on Update | Notifikasi saat tiket diupdate |

### 3.6.8 Fitur Sistem dan Konfigurasi

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | General Settings | Konfigurasi polling interval, theme (Dark/Light) |
| 2 | Monitoring Settings | AI enable/disable, retention policy, simulation mode |
| 3 | Audio Settings | Custom notification sounds management |
| 4 | Integration Settings | Telegram Bot token dan Chat ID configuration |
| 5 | Mobile Connectivity | Backend URL untuk koneksi mobile APK |
| 6 | System Logs | Log aktivitas sistem |
| 7 | Data Flush | Hapus notifikasi/log secara batch |

---

## 3.7 tools dan Teknologi yang Digunakan

### 3.7.1 Frontend Development

| Tool | Version | Fungsi |
|------|---------|--------|
| React.js | v18+ | Frontend framework |
| Vite | v5+ | Build tool dan dev server |
| TypeScript | v5+ | Type-safe JavaScript |
| Tailwind CSS | v3+ | Utility-first CSS framework |
| React-Leaflet | v4+ | Peta interaktif |
| Recharts | v2+ | Grafik dan visualisasi data |
| Lucide React | Latest | Icon library |
| React-Hot-Toast | Latest | Toast notifications |

### 3.7.2 Backend Development

| Tool | Version | Fungsi |
|------|---------|--------|
| Node.js | v18+ | JavaScript runtime |
| Express.js | v4+ | Web framework |
| MySQL | v5.7+ | Database server |
| RouterOS API | - | Komunikasi MikroTik |
| SNMP | - | Protokol monitoring generic |
| JSON Web Token | - | Authentication |
| Bcrypt.js | - | Password hashing |
| Nodemailer | - | Email service |
| TensorFlow.js | v4+ | AI/ML engine |

### 3.7.3 Mobile Development

| Tool | Version | Fungsi |
|------|---------|--------|
| Capacitor.js | v6+ | Native app wrapper |
| Android Studio | Latest | Android SDK & build |
| Local Notifications | - | Native push notifications |

### 3.7.4 Development Tools

| Tool | Fungsi |
|------|--------|
| Git | Version control |
| npm/yarn | Package management |
| VS Code | Code editor |
| Laragon/XAMPP | Local development environment |
| Postman | API testing |

---

## 3.8 Teknik Analisis Data

### 3.8.0 Teknik Pengumpulan Data dari Perangkat MikroTik

Pengumpulan data dari perangkat MikroTik dilakukan menggunakan **dua protokol utama**:

#### a. RouterOS API (Protocol Utama)

| Aspek | Detail |
|-------|--------|
| **Protocol** | TCP/IP dengan autentikasi username/password |
| **Port** | 8728 (HTTP) / 8729 (HTTPS) |
| **Library** | routeros-client / API MikroTik |
| **Kecepatan** | Lebih cepat, data lebih detail |

**Data yang dikumpulkan melalui RouterOS API:**

| Kategori | API Command | Data yang Diambil |
|----------|-------------|-------------------|
| **Interface** | `/interface/print` | Nama, status, MAC address, type |
| **Traffic Monitor** | `/interface/monitor-traffic` | TX/RX bytes, packets, errors |
| **System Resource** | `/system/resource/print` | CPU load, memory usage, uptime |
| **Hotspot Users** | `/ip/hotspot/active/print` | Active users, session time |
| **Queue/Bandwidth** | `/queue/simple/print` | Bandwidth limit, current usage |
| **Wireless** | `/interface/wireless/print` | Connected clients, signal strength |
| **ARP Table** | `/ip/arp/print` | MAC-IP mapping |
| **Log System** | `/log/print` | System logs, events |

**Flow Pengumpulan Data:**

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                        │
│                                                             │
│  1. Koneksi TCP ke MikroTik (port 8728)                    │
│     ↓                                                       │
│  2. Login dengan username/password RouterOS                 │
│     ↓                                                       │
│  3. Kirim API Command:                                      │
│     /interface print                                        │
│     /interface monitor-traffic once                         │
│     /system resource print                                  │
│     ↓                                                       │
│  4. Parse response (JSON format)                           │
│     ↓                                                       │
│  5. Simpan ke MySQL Database                                │
│     ↓                                                       │
│  6. Kirim Notifikasi (jika threshold exceeded)              │
└─────────────────────────────────────────────────────────────┘
```

**Contoh Implementasi (Node.js):**

```javascript
// Koneksi ke MikroTik via RouterOS API
import { RouterOSAPI } from 'routeros-client';

const connectMikrotik = async (device) => {
  const api = new RouterOSAPI({
    host: device.host,
    user: device.user,
    password: device.password,
    port: device.port || 8728,
  });

  // Ambil interface list
  const interfaces = await api.write('/interface/print');

  // Ambil traffic monitor (sekali saja)
  const traffic = await api.write('/interface/monitor-traffic', {
    numbers: '0',
    once: true,
  });

  // Ambil system resource
  const resource = await api.write('/system/resource/print');

  return { interfaces, traffic, resource };
};
```

#### b. SNMP Protocol (Protocol Cadangan)

| Aspek | Detail |
|-------|--------|
| **Protocol** | UDP dengan community string |
| **Port** | 161 (polling), 162 (traps) |
| **Library** | net-snmp |
| **Use Case** | Device non-MikroTik atau monitoring generik |

**OID SNMP yang Digunakan:**

| OID | Data | Description |
|-----|------|-------------|
| `.1.3.6.1.2.1.2.2.1` | Interface Statistics | TX/RX bytes, packets |
| `.1.3.6.1.2.1.1.3` | Uptime | System uptime |
| `.1.3.6.1.2.1.25.1.1.0` | Host Resources | CPU time |
| `.1.3.6.1.2.1.1.5.0` | System Name | Hostname |
| `.1.3.6.1.2.1.1.1.0` | System Description | Device info |

**Konfigurasi SNMP di MikroTik:**

```bash
# Aktifkan SNMP
/snmp set enabled=yes

# Set community string
/snmp set community=public

# Set contact dan location
/snmp set contact=admin@itats.ac.id
/snmp set location="ITATS Campus"
```

#### c. Perbandingan RouterOS API vs SNMP

| Aspek | RouterOS API | SNMP |
|-------|-------------|------|
| **Kecepatan** | ⚡ Lebih cepat | 🐢 Lebih lambat |
| **Data Detail** | ✅ Sangat detail (full access) | ⚠️ Terbatas (standard MIB) |
| **Konfigurasi** | ✅ Bisa mengubah setting | ❌ Read-only |
| **Resource Device** | ⚠️ Lebih berat | ✅ Lebih ringan |
| **Kompleksitas** | ⚠️ Lebih kompleks | ✅ Simpler |

#### d. Interval Pengumpulan Data

| Data Type | Default Interval | Configurable |
|-----------|------------------|--------------|
| Interface Traffic | 10 detik | Ya (5-60 detik) |
| System Resource | 30 detik | Ya |
| Wi-Fi Clients | 15 detik | Ya |
| Uptime Check | 30 detik | Ya |
| Log Polling | 60 detik | Ya |

### 3.8.1 Analisis Prediksi Kepadatan Jaringan (AI)

Metode yang digunakan adalah **Convolutional Neural Network 1-Dimensional (CNN-1D)** dengan TensorFlow.js untuk prediksi kepadatan trafik jaringan:

1. **Data Collection**
   - Mengumpulkan data historis jumlah client wifi per interval waktu
   - Minimal 17 data points diperlukan untuk training

2. **Preprocessing**
   - Normalisasi data ke skala 0-1
   - Windowing data sesuai window size (default: 12 points)
   - Split data: 80% training, 20% validation

3. **Model Training**
   - Arsitektur: Conv1D → MaxPooling → Conv1D → Dense → Output
   - Loss function: Mean Squared Error (MSE)
   - Optimizer: Adam
   - Epochs: 50 (configurable)

4. **Prediction**
   - Input: window data terakhir
   - Output: predicted density level (High/Medium/Low)
   - Cache results untuk menghindari re-training

### 3.8.2 Analisis Performansi Sistem

Metrik yang diukur:
- **Response Time**: Waktu respons API endpoint
- **Throughput**: Jumlah request per detik
- **Availability**: Uptime sistem
- **Error Rate**: Persentase error terhadap total request

---

## 3.9 Pengujian Sistem

### 3.9.1 Skenario Pengujian Fungsional

| No | Test Case | Expected Result |
|----|----------|----------------|
| 1 | Login dengan kredensial valid | Berhasil login, redirect ke dashboard |
| 2 | Login dengan kredensial invalid | Tampilkan error message |
| 3 | JWT token expired | Auto-logout, redirect ke login |
| 4 | CRUD MikroTik Device | Data tersimpan/dihapus di database |
| 5 | Polling MikroTik API | Data interface tampil di dashboard |
| 6 | Device Offline Alert | Notifikasi toast dan Telegram muncul |
| 7 | AI Prediction | Hasil prediksi tampil di widget AI |
| 8 | OTP Password Reset | Password berhasil direset via email |
| 9 | Export Interface CSV | File CSV terdownload |
| 10 | Mobile APK Build | APK berhasil di-build dan run |

### 3.9.2 Skenario Pengujian Performansi

| No | Test Case | Metric |
|----|----------|--------|
| 1 | API Response Time | < 2000ms |
| 2 | Concurrent Users (10) | 0% error rate |
| 3 | Dashboard Load Time | < 3 detik |
| 4 | Polling Interval Stability | Stabil pada interval 10-15 detik |
| 5 | Database Query Time | < 500ms |

---

## 3.10 Jadwal Penelitian

| No | Tahapan | Bulan 1 | Bulan 2 | Bulan 3 | Bulan 4 |
|----|--------|:------:|:------:|:------:|:------:|
| 1 | Persiapan & Studi Literatur | ● | | | |
| 2 | Analisis Kebutuhan | ● | | | |
| 3 | Perancangan Sistem | ● | ● | | |
| 4 | Implementasi Backend | | ● | ● | |
| 5 | Implementasi Frontend | | ● | ● | |
| 6 | Integrasi Sistem | | | ● | |
| 7 | Pengujian Sistem | | | | ● |
| 8 | Revisi & Finalisasi | | | | ● |
| 9 | Penyusunan Laporan | | ● | ● | ● |

**Keterangan:**
- ● = Aktif bekerja pada bulan tersebut

---

## 3.11 Kerangka Berpikir (Conceptual Framework)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUKTUR JARINGAN KAMPUS                       │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│   │ MikroTik    │  │ MikroTik    │  │ Access      │  │ Switch/     │          │
│   │ Router 1    │  │ Router 2    │  │ Points      │  │ Controller │          │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│          │                │                │                │                  │
└──────────┼────────────────┼────────────────┼────────────────┼──────────────────┘
           │                │                │                │
           │    RouterOS API / SNMP          │                │
           │                │                │                │
           ▼                ▼                ▼                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND PROCESSING LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Telemetry   │  │   AI/ML      │  │ Notification │  │    Auth      │    │
│  │  Worker      │  │  Engine      │  │  Service     │  │  Service     │    │
│  │  (Polling)   │  │  (TensorFlow)│  │  (Telegram)  │  │  (JWT/OTP)   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │            │
│         ▼                 ▼                 ▼                 ▼            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         MySQL DATABASE                             │    │
│  │  ┌─────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────────┐   │    │
│  │  │Devices  │ │Access Points│ │Notifications│ │  AI Model      │   │    │
│  │  │ Table   │ │  Table      │ │   Table      │ │   Cache        │   │    │
│  │  └─────────┘ └────────────┘ └──────────────┘ └────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ REST API
                                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT INTERFACES                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                 │
│  │   WEB ADMIN PORTAL       │  │   ANDROID APK            │                 │
│  │   (React + Vite)         │  │   (Capacitor)            │                 │
│  │                          │  │                          │                 │
│  │  ┌──────────────────┐    │  │  ┌──────────────────┐   │                 │
│  │  │ • Dashboard     │    │  │  │  • Dashboard      │   │                 │
│  │  │ • Topology Map  │    │  │  │  • Notifications  │   │                 │
│  │  │ • Campus Map    │    │  │  │  • Status Board   │   │                 │
│  │  │ • Device Mgmt   │    │  │  │  • Quick Access   │   │                 │
│  │  │ • Smart Central │    │  │  └──────────────────┘   │                 │
│  │  │ • Settings      │    │  └─────────────────────────┘                 │
│  │  │ • Notifications │    │                                               │
│  │  │ • Tickets       │    │                                               │
│  │  └──────────────────┘    │                                               │
│  └─────────────────────────┘                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3.12 Definisi Operasional Variabel

### 3.12.1 Variabel Independen (Input)

| Variabel | Definisi Operasional | Indikator |
|----------|---------------------|-----------|
| Status Perangkat | Status ketersediaan perangkat jaringan (MikroTik, AP) | Online/Offline |
| Traffic VLAN | Volume data yang melewati setiap VLAN interface | Rx/Tx bytes per second |
| Wi-Fi Clients | Jumlah perangkat yang terhubung ke jaringan wifi | Count devices |
| SNMP Metrics | Data sistem dari protocol SNMP | CPU Load, Memory, Uptime |

### 3.12.2 Variabel Dependen (Output)

| Variabel | Definisi Operasional | Indikator |
|----------|---------------------|-----------|
| Prediksi Kepadatan | Output AI untuk prediksi kepadatan jaringan | High/Medium/Low |
| Notifikasi Alert | Informasi peringatan yang dikirim ke admin | Jumlah dan tipe alert |
| Dashboard Metrics | Data visual di dashboard | Charts, stats cards |
| Availability Rate | Persentase uptime perangkat | (Online Devices / Total Devices) × 100% |

---

## 3.13 Ringkasan

Bab III ini menjelaskan metode penelitian yang digunakan, yaitu **Penelitian dan Pengembangan (R&D)** dengan pendekatan **SDLC Waterfall**. Prosedur penelitian mencakup tahap persiapan, analisis kebutuhan, perancangan sistem, implementasi, pengujian, dan deployment.

Sistem yang dikembangkan adalah **Nexus - Sistem Monitoring Jaringan Terintegrasi** dengan fitur utama meliputi:
- Dashboard real-time dengan visualisasi data
- Monitoring perangkat MikroTik via API RouterOS dan SNMP
- Visualisasi topologi dan peta kampus
- Notifikasi otomatis via Telegram
- AI Engine untuk prediksi kepadatan jaringan
- Authentication dengan JWT dan OTP
- Mobile app via Capacitor

Kebutuhan sistem meliputi hardware server, software Node.js + MySQL, dan koneksi jaringan ke perangkat MikroTik. Pengujian dilakukan dengan black box testing, white box testing, UAT, dan performance testing.

---

*Dokumen ini merupakan bagian dari Proposal Skripsi berjudul:*
*"Rancang Bangun Sistem Monitoring Jaringan Terintegrasi Berbasis Web Dan Mobile Untuk Kampus ITATS"*