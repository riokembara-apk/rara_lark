import express from "express";
import axios from "axios";
import FormData from "form-data";

const app = express();
app.use(express.json());

// === CONFIG ===
const LARK_APP_ID = process.env.LARK_APP_ID;
const LARK_APP_SECRET = process.env.LARK_APP_SECRET;
const OPENAI_KEY = process.env.OPENAI_KEY;

// === GET TENANT ACCESS TOKEN ===
async function getTenantToken() {
  const res = await axios.post(
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/",
    {
      app_id: LARK_APP_ID,
      app_secret: LARK_APP_SECRET,
    }
  );
  return res.data.tenant_access_token;
}

// === DOWNLOAD FILE FROM LARK ===
async function downloadFile(fileToken) {
  const tenantToken = await getTenantToken();

  const res = await axios.get(
    `https://open.larksuite.com/open-apis/drive/v1/files/${fileToken}/download`,
    {
      headers: { Authorization: `Bearer ${tenantToken}` },
      responseType: "arraybuffer",
    }
  );

  return res.data;
}

// === SEND TO OPENAI TO EXTRACT TEXT ===
async function extractText(buffer) {
  const form = new FormData();
  form.append("file", buffer, "document.pdf");
  form.append("model", "gpt-4o-mini");

  const res = await axios.post(
    "https://api.openai.com/v1/files",
    form,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        ...form.getHeaders(),
      },
    }
  );

  // Extract text
  const fileId = res.data.id;
  const parseRes = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model: "gpt-4o-mini",
      input: { file_id: fileId },
    },
    {
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    }
  );

  return parseRes.data.output_text;
}

// === MAIN ENDPOINT for LARK ===
app.post("/webhook", async (req, res) => {
  try {
    const { attachment } = req.body; // from Lark automation step 2

    if (!attachment || !attachment.file_token) {
      return res.json({
        error: "No attachment received",
        body: "",
      });
    }

    // 1. Download file
    const fileBuffer = await downloadFile(attachment.file_token);

    // 2. Extract text via OpenAI
    const text = await extractText(fileBuffer);

    // 3. Send extracted text to Lark (Step 3)
    return res.json({
      body: text
    });

  } catch (e) {
    console.error(e);
    res.json({ error: e.message });
  }
});

// === RUN SERVER ===
app.listen(3000, () => {
  console.log("Server berjalan di port 3000");
});
