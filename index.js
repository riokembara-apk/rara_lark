const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

// =======================
// 1. KONFIGURASI CLIENT
// =======================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // isi di Secrets Replit
});

// Lark app credential (buat step lanjut download file)
// Sekarang boleh dikosongkan dulu, nanti kita pakai kalau mau tarik isi file asli
const LARK_APP_ID = process.env.LARK_APP_ID;
const LARK_APP_SECRET = process.env.LARK_APP_SECRET;

// =======================
// 2. PROMPT ANALISA DOKUMEN
// =======================

// PASTE isi prompt panjang kamu (yang di Step 3 Lark: "Tugasmu adalah menganalisis dokumen...")
// ke dalam variable PROMPT_ANALISA di bawah ini:
const PROMPT_ANALISA = `
Tugasmu adalah menganalisis dokumen apapun yang diunggah user, baik dokumen hukum formal maupun non-hukum, untuk mengidentifikasi:
1. Risiko hukum dan kepatuhan
2. Implikasi bisnis dan komersial
3. Potensi masalah administratif, etika, atau reputasi
4. Kesalahan bahasa atau struktur yang dapat menimbulkan salah tafsir
5. Saran revisi profesional

Jawabanmu harus rapi, terstruktur dengan heading & bullet point,
dan gunakan bahasa Indonesia yang sopan dan profesional.

Kalau dokumen tidak lengkap atau informasinya minim, jelaskan dengan sopan
informasi apa saja yang masih kurang.

==== FORMAT JAWABAN ====
1. Ringkasan Singkat Dokumen
2. Identifikasi Risiko Hukum & Kepatuhan
3. Dampak Bisnis & Komersial
4. Catatan Bahasa & Struktur Dokumen
5. Rekomendasi Perbaikan / Tindak Lanjut
`;

// =======================
// 3. FUNGSI PANGGIL OPENAI
// =======================

async function analisaDokumenDenganOpenAI({ judul, jenis, catatanUser, fileInfo }) {
  const konteks = `
Judul dokumen: ${judul || "-"}
Jenis dokumen: ${jenis || "-"}
Catatan / pesan user: ${catatanUser || "-"}

Informasi file dari Lark:
${fileInfo ? JSON.stringify(fileInfo, null, 2) : "-"}
`;

  const resp = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions: PROMPT_ANALISA,
    input: konteks,
  });

  // output_text = gabungan semua text dari model
  return resp.output_text;
}

// =======================
// 4. ENDPOINT WEBHOOK UNTUK LARK
// =======================

// Lark Automation -> HTTP Request
// Method: POST
// URL:   https://<link replit kamu>/lark-webhook
app.post("/lark-webhook", async (req, res) => {
  try {
    console.log("==== DATA DARI LARK ====");
    console.log(JSON.stringify(req.body, null, 2));

    // --- SESUAIKAN DENGAN BODY YANG KAMU KIRIM DARI LARK ---
    // SARAN: di step HTTP Request Lark, set body JSON seperti ini:
    // {
    //   "judul": "{{Judul Dokumen}}",
    //   "jenis": "{{Jenis Dokumen}}",
    //   "pesan": "{{Pesan}}",
    //   "attachment": {{Attachment}}
    // }
    //
    // Di Node, kita baca seperti di bawah:

    const {
      judul,
      jenis,
      pesan,
      attachment, // biasanya array object berisi file_token, file_name, dll
    } = req.body || {};

    // Info file hanya kita pakai sebagai konteks dulu.
    // Nanti kalau mau advance, baru kita download isi file dari Lark pakai file_token.
    const fileInfo = attachment;

    const hasilAnalisa = await analisaDokumenDenganOpenAI({
      judul,
      jenis,
      catatanUser: pesan,
      fileInfo,
    });

    // Response ke Lark (nanti bisa dipakai di step "Update record")
    res.json({
      ok: true,
      message: "Analisa berhasil",
      analysis: hasilAnalisa,
    });
  } catch (err) {
    console.error("ERROR di /lark-webhook:", err);
    res.status(500).json({
      ok: false,
      message: "Terjadi error di server",
      error: err.message,
    });
  }
});

// =======================
// 5. JALANKAN SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server berjalan di port", PORT);
});
