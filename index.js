// index.js
// Backend Rara AI x Lark
// - Terima file_token dari Lark
// - Download file dari Lark Drive
// - Extract text (PDF/DOCX/TXT)
// - Kirim ke OpenAI dengan prompt Rara AI Lawyer
// - Balikkan hasil analisis ke Lark

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

const LARK_APP_ID = process.env.LARK_APP_ID;
const LARK_APP_SECRET = process.env.LARK_APP_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// =======================
// 1. Helper: Ambil tenant_access_token Lark
// =======================
async function getTenantAccessToken() {
  const url =
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal";

  const res = await axios.post(url, {
    app_id: LARK_APP_ID,
    app_secret: LARK_APP_SECRET,
  });

  if (res.data.code !== 0) {
    console.error("Gagal ambil tenant_access_token:", res.data);
    throw new Error("Failed to get tenant_access_token from Lark");
  }

  return res.data.tenant_access_token;
}

// =======================
// 2. Helper: Download file dari Lark Drive
// =======================
async function downloadFileFromLark(fileToken) {
  const tenantToken = await getTenantAccessToken();

  const url = `https://open.larksuite.com/open-apis/drive/v1/files/${fileToken}/download`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${tenantToken}`,
    },
    responseType: "arraybuffer",
  });

  return Buffer.from(res.data);
}

// =======================
// 3. Helper: Extract text dari PDF/DOCX/TXT
// =======================
async function extractText(buffer, fileName) {
  const lower = (fileName || "").toLowerCase();

  // PDF
  if (lower.endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    return data.text;
  }

  // DOCX
  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Format lain → coba sebagai text biasa
  return buffer.toString("utf8");
}

// =======================
// 4. Helper: Panggil OpenAI (Chat Completions)
// =======================
async function analyzeWithOpenAI(docText) {
  const promptSystem = `
Kamu adalah Rara AI Lawyer, AI Legal Counsel profesional di bidang hukum, bisnis, teknologi, dan regulasi Indonesia.
Tugasmu adalah menganalisis dokumen apapun yang diunggah oleh user, baik dokumen hukum formal maupun non-hukum, untuk mengidentifikasi:
1. Risiko hukum dan kepatuhan
2. Implikasi bisnis dan komersial
3. Potensi masalah administratif, etika, atau reputasi
4. Kesalahan bahasa atau struktur yang dapat menimbulkan salah tafsir
5. Saran revisi profesional
  `.trim();

  const promptUser = `
=== TEKS DOKUMEN ===
${docText}

=== TUGAS ANALISIS ===
A. Ringkasan Eksekutif
- Jenis dokumen dan tujuan utama dokumen tersebut.
- Siapa pihak yang berkepentingan.
- Apa konteks atau maksud yang bisa disimpulkan.

B. Risiko & Implikasi
- Risiko hukum (jika ada)
- Risiko bisnis dan reputasi
- Risiko administratif atau teknis

C. Bahasa / Struktur
- Kesalahan penulisan, gaya bahasa tidak profesional, potensi multitafsir
- Ketidaksesuaian format atau penyusunan informasi

D. Saran Perbaikan / Rekomendasi Langkah Selanjutnya
- Jika dokumen perlu revisi, berikan versi perbaikannya (dalam bentuk poin-poin atau kalimat yang diperbaiki).
- Jika dokumen bersifat teknis atau non-hukum, berikan rekomendasi struktur atau tindakan mitigasi.

E. Penilaian Akhir & Rekomendasi Strategis
- Apa tindakan yang sebaiknya dilakukan oleh user
- Apakah perlu konsultasi lanjutan, negosiasi, atau tindakan hukum

Berikan jawaban terstruktur dengan heading A, B, C, D, E seperti di atas.
  `.trim();

  const url = "https://api.openai.com/v1/chat/completions";

  const res = await axios.post(
    url,
    {
      model: "gpt-4.1-mini", // boleh diganti model lain
      temperature: 0.2,
      messages: [
        { role: "system", content: promptSystem },
        { role: "user", content: promptUser },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const choice = res.data.choices?.[0]?.message?.content || "";
  return choice.trim();
}

// =======================
// 5. Endpoint utama untuk Lark Automation
// =======================

app.post("/analyze", async (req, res) => {
  try {
    console.log("==== DATA DARI LARK ====");
    console.log(req.body);

    const { file_token, file_name } = req.body;

    if (!file_token) {
      return res.status(400).json({
        error: "file_token wajib dikirim dari Lark.",
      });
    }

    // 1. Download file dari Lark
    const buffer = await downloadFileFromLark(file_token);

    // 2. Extract text
    const text = await extractText(buffer, file_name || "");

    if (!text || text.trim().length < 20) {
      return res.status(200).json({
        analysis:
          "Dokumen tidak memiliki cukup teks untuk dianalisis (mungkin kosong atau hanya gambar).",
      });
    }

    // 3. Analisis dengan OpenAI
    const analysis = await analyzeWithOpenAI(text);

    // 4. Balikkan ke Lark
    return res.status(200).json({
      ok: true,
      analysis,
    });
  } catch (err) {
    console.error("ERROR /analyze:", err.response?.data || err.message);

    return res.status(500).json({
      ok: false,
      error: "Terjadi error di server Rara AI. Detail: " + err.message,
    });
  }
});

// =======================
// 6. Root route (opsional)
// =======================
app.get("/", (req, res) => {
  res.send("Rara AI Lark backend is running.");
});

// =======================

app.listen(PORT, () => {
  console.log("Server berjalan di port", PORT);
});
