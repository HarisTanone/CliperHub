# 🍪 Panduan Cookies YouTube — AutoCliper v2

YouTube memerlukan cookies untuk download video agar tidak terblokir oleh sistem bot detection.

---

## Daftar Isi

- [Kenapa Perlu Cookies?](#kenapa-perlu-cookies)
- [Solusi Otomatis (Disarankan)](#-solusi-otomatis-disarankan)
- [Solusi Manual](#-solusi-manual)
- [Urutan Prioritas](#-urutan-prioritas)
- [Keamanan](#-keamanan)
- [Troubleshooting](#-troubleshooting)

---

## Kenapa Perlu Cookies?

Saat muncul error berikut:
```
ERROR: [youtube] VIDEO_ID: Sign in to confirm you're not a bot
```

Ini berarti YouTube mendeteksi request sebagai bot. Solusinya adalah memberikan cookies dari browser yang sudah login ke YouTube.

---

## ✅ Solusi Otomatis (Disarankan)

Sistem akan **otomatis** mengambil cookies dari browser Anda.

### Langkah-langkah:
1. **Login ke YouTube** di browser favorit (Chrome/Safari)
2. **Tonton video** yang ingin didownload (minimal 1x)
3. **Restart server** AutoCliper

```bash
./start.sh
# atau
python3 main.py
```

Sistem akan mencoba mengambil cookies dari:
1. Chrome
2. Safari
3. Firefox

> 💡 Tidak perlu melakukan apapun tambahan — cukup pastikan sudah login di browser.

---

## 🔧 Solusi Manual

Jika solusi otomatis gagal, export cookies secara manual.

### Metode 1: Chrome Extension (Disarankan)

1. **Install extension** "Get cookies.txt LOCALLY" dari Chrome Web Store
2. **Buka YouTube** dan login
3. **Klik icon extension** → "Export" → Download `cookies.txt`
4. **Copy ke root project:**
   ```bash
   cp ~/Downloads/cookies.txt /path/to/autocliper-v2/
   ```
5. **Restart server**

### Metode 2: yt-dlp (Safari)

```bash
yt-dlp --cookies-from-browser safari \
  --cookies cookies.txt \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Cookies tersimpan di cookies.txt
```

### Metode 3: Panduan Resmi yt-dlp

Ikuti panduan di: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp

---

## 📊 Urutan Prioritas

Sistem mencoba cookies dengan urutan:

1. ✅ **Chrome cookies** — Paling reliable di macOS
2. ✅ **Safari cookies** — Default browser macOS
3. ✅ **Firefox cookies** — Jika terinstal
4. ❌ **Gagal** — Error dengan instruksi perbaikan

---

## 🔒 Keamanan

- Cookies disimpan **lokal** di komputer Anda
- **Jangan** bagikan file `cookies.txt` ke orang lain
- Cookies berisi session login YouTube Anda
- File `cookies.txt` sudah ada di `.gitignore` (tidak akan ter-commit)

---

## 🐛 Troubleshooting

### Error: "could not find chrome cookies database"
- Pastikan Chrome terinstal dan sudah login ke YouTube
- Coba browser lain (Safari/Firefox)

### Error: "Sign in to confirm you're not a bot" (masih muncul)
- Cookies mungkin sudah expired → Login ulang ke YouTube di browser
- Coba export cookies manual (Metode 1 di atas)
- Pastikan sudah menonton video di browser

### Cookies Expired?
Cookies YouTube biasanya valid 1-2 minggu. Jika expired:
1. Login ulang ke YouTube di browser
2. Restart server

### Tips
1. Gunakan akun YouTube biasa (bukan brand account)
2. Login di browser sebelum menjalankan server
3. Tonton video minimal 1x sebelum download
4. Update cookies setiap 1-2 minggu
5. Restart server setelah update cookies

---

↩️ [Kembali ke README](../README.md)
