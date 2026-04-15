<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Monitoring Jaringan ITATS (Nexus)

Sistem Monitoring Jaringan Terintegrasi Kampus ITATS — **Web Admin Portal & Android Mobile Application**. Solusi terpusat untuk visualisasi perangkat jaringan (MikroTik), topologi, polling statis, peringatan, dan insight Artificial Intelligence.

</div>

<br>

## ✨ Fitur Utama

- **Live Topology & Real-time Web:** Memetakan status perangkat (Router / Access Point), VLAN, Adapter Controller, dsb langsung dari mesin router via API RouterOS.
- **Background Telemetry Worker (Cron):** Sistem *auto-polling* berjalan secara berbayang 24/7 di backend menembak request ke MikroTik dan menyimpan telemetri langsung ke server pusat (MySQL Database).
- **Telegram Bot Integration:** Notifikasi instan di *channel* / *private message* saat ada Access Point atau Device prioritas yang OFFLINE.
- **Sistem Autentikasi Super Ketat:** Implementasi JWT expiry check secara *client-side*, custom 404 Pages, dan Auto-Logout.
- **Smart Admin Management (OTP Email):** Modul CRUD lengkap bagi role administrator dengan fitur perlindungan Lupa Password/Ubah Password menggunakan kode verifikasi One-Time-Password ke Email Gmail spesifik.
- **Multi-Platform Support (Vite + Capacitor JS):** Aplikasi siap dibuild sebagai sistem tunggal (Monorepo) untuk kebutuhan Web Produksi *(Express Static Serving)* di VPS, dan di-export sebagai **Aplikasi Native Android (APK)** untuk diakses dari Smartphone dengan interface Responsif.

<br>

## 🛠️ Stack Teknologi

- **Frontend:** React JS, Vite, Tailwind CSS (Mobile-First styling), Lucide-React, React-Leaflet
- **Backend:** Node.js, Express, MySQL (Laragon / XAMPP)
- **Komunikasi Mikrotik / Perangkat:** RouterOS API Client, SNMP API 
- **Keamanan / Auth:** JWT, Bcrypt JS
- **Mobile Wrapper:** Capacitor JS
- **Mailing:** Nodemailer (SMTP by Google)

<br>

## 🚀 Instalasi Terpusat (Local Development)

Semua proses *development* berada di dalam satu folder repository (Monorepo).

### 1. Prasyarat Sistem
- **Node.js** (Minimal versi 18 atau ke atas)
- **Database Server:** MySQL (Disarankan memakai Laragon, XAMPP, atau DB Desktop sejenis)

### 2. Setup Modul
Buka repository ini, lalu buka console Anda untuk mengeksekusi instalasi seluruh package yang diperlukan.
```bash
npm install
```

### 3. Konfigurasi Environment Variable
Buat atau konfigurasi file `.env` di folder *root* untuk memodifikasi letak konfigurasi:

```env
# Koneksi Database
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_USER="root"
DB_PASS=""
DB_NAME="wifi_itats.db"

# Mode Uji Coba tanpa terhubung langsung ke Mikrotik kampus
MIKROTIK_SIMULATION_MODE="false"

# Pengaturan SMTP (Recovery Password) - Pakai Gmail App Password
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="<email_anda>@gmail.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"
SMTP_FROM_NAME="Monitoring Jaringan ITATS"
SMTP_RESET_EMAIL="<email_anda>@gmail.com"

# Pengaturan Ekspor Aplikasi Mobile / Capacitor (PENTING!)
# Saat development ganti IP dengan IP LOKAL koneksi internet laptop Anda (bukan localhost) agar APK / Smartphone narik API ke sini.
VITE_API_URL="http://192.168.1.x:3000"
```

### 4. Running Project (Web View)
Setiap aplikasi jalan ke DB MySQL baru, API secara otomatis akan mem-bangun struktur tabel (Migrations). Cukup jalankan:
```bash
npm run dev
```

Buka URL **http://localhost:3000**.
- Default user login test: Username `admin` | Password `admin123`.

<br>

## 📱 Export Project jadi APK (Capacitor Android)

Karena arsitekturnya sudah disediakan, mengubahnya menjadi aplikasi native HP sangatlah cepat. Pastikan *Android Studio* sudah tertanam di sistem Anda.

1. Matikan node server dan jadikan code react ini HTML/CSS *raw* (Mengekspor file `dist/`):
   ```bash
   npm run build
   ```
2. Singkronkan file hasil produksi tersebut dengan kerangka kerja Capacitor:
   ```bash
   npx cap sync android
   ```

#ganti asset : 
```bash
npx @capacitor/assets generate --android


3. Buka project Android di Android Studio:
   ```bash
   npx cap open android
   ```
4. Di Android Studio, tunggu indikator Gradle muter di bagian bawah selesai. Tekan **Run (Play)** untuk ke *Emulator* PC, atau colok HP Anda dan **Build APK** untuk *install* fisik.

> **Note PENTING Android Build**: APK yang dirilis dari cara di atas WAJIB terhubung ke internet/wifi yang merujuk server `VITE_API_URL` yang dideklarasikan di variabel `.env` pada saat build. Selama Laptop (Server) mati, maka HP tidak bisa mengakses datanya.

<br>

## 🌐 Mode Hosting Website (Production / VPS)

Jika Anda ingin mendistribusikan aplikasi secara publik, berikut adalah panduan lengkap dari nol (0) untuk melakukan *deployment* layanan *(Web + Backend API)* ke dalam sebuah Virtual Private Server (VPS) bersistem operasi Ubuntu / Debian.

### Tahap 1: Persiapan Server (Requirement)
Pastikan VPS Anda baru/segar dan akses via SSH. Jalankan perintah berikut untuk menginstall seluruh pendukung:
```bash
# 1. Update Server
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (v18+) & NPM
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Nginx (Web Server Proxy)
sudo apt install nginx -y

# 4. Install PM2 (Process Manager agar Node.js nyala 24/7)
sudo npm install -g pm2

# 5. Install MySQL Server
sudo apt install mysql-server -y
```

### Tahap 2: Konfigurasi Database (MySQL)
Buat user dan database untuk ditarik oleh sistem (Contoh: `wifi_itats_db`).
```bash
sudo mysql
```
Jalankan query di dalam MySQL Shell:
```sql
CREATE DATABASE wifi_itats_db;
CREATE USER 'admin_itats'@'localhost' IDENTIFIED BY 'PasswordKuat123!';
GRANT ALL PRIVILEGES ON wifi_itats_db.* TO 'admin_itats'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Tahap 3: Upload dan Build Aplikasi
1. Pindahkan folder project `monitoring-jaringan-itats` Anda utuh ke VPS (misalnya ke directory `/var/www/monitoring-jaringan-itats`). Bisa gunakan rsync, FileZilla, atau git clone.
2. Masuk ke folder project:
   ```bash
   cd /var/www/monitoring-jaringan-itats
   ```
3. Install package dan atur `.env`:
   ```bash
   npm install
   nano .env
   ```
   *(Isi konfigurasi DB sesuai dengan Tahap 2. Kosongkan `VITE_API_URL` agar Web melacak relative path, atau ubah menjadi domain publik jika memakai domain beda server).*
4. Lakukan Build untuk me-render antarmuka Vite/React.
   ```bash
   npm run build
   ```

### Tahap 4: Menjalankan Backend 24/7 dengan PM2
Agar Node.js API (dan service background) nyala terus meski SSH Anda tutup:
```bash
# Gunakan tsx untuk mengeksekusi server index
pm2 start npx --name "nexus-api" -- tsx server/index.ts

# Set agar PM2 otomatis menyala dan run botnya lagi setiap VPS / Server Reboot
pm2 startup
pm2 save
```
> **Info:** Server sekarang berjalan di `http://127.0.0.1:3000` (termasuk folder `./dist` React-nya karena kita sudah set app.use(static)).

### Tahap 5: Konfigurasi Domain & Nginx (Proxy)
Arahkan Top Level Domain yang Anda miliki (contoh: `monitoring.itats.ac.id`) menggunakan mode reverse-proxy dari Nginx agar berjalan di Port 80 (HTTP).

1. Buat Config Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/nexus
   ```
2. Isi Config (Ganti domain dengan IP VPS / TLD Asli):
   ```nginx
   server {
       listen 80;
       server_name monitoring.itats.ac.id; # GANTI DOMAIN ANDA

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
3. Aktifkan dan Restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### Tahap 6 (Opsional tapi PENTING): SSL & HTTPS
Aplikasi berbasis API / Capacitor mobile HARUS memakai HTTPS. Instal **Certbot (Let's Encrypt)**:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d monitoring.itats.ac.id
```
*(Certbot akan otomatis memodifikasi Nginx Anda ke mode HTTPS secara cerdas).*

*Voila! Hosting telah selesai dan Server Nexus memonitor ratusan switch kampus Anda!*

<br>

## ⚡ Tips & Troubleshooting

### Bagaimana Jika File Sampah Telanjur Masuk Git?
Jika Anda baru saja mengubah aturan di dalam `.gitignore` (misalnya agar folder `.idea`, file `.env`, atau *database* `.sqlite` diabaikan), namun file-file tersebut **sudah telanjur ter-commit di masa lalu**, maka Git akan tetap melacaknya. 

Untuk memaksa Git "melupakan" file-file tersebut dan patuh pada `.gitignore` terbaru tanpa menghapus filenya dari komputer Anda, jalankan 3 perintah sakti ini di terminal Anda:

```bash
git rm -r --cached .
git add .
git commit -m "chore: apply new .gitignore rules and clear cache"
```
*Saran: Gunakan teknik ini setiap kali Anda membereskan file-file sensitif atau file build yang bocor ke repository GitHub tim Anda.*

<br>

© 2026 Administrator Portal Nexus - ITATS Monitoring Group.
