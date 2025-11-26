import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// === FIX BODY PARSER (WAJIB UNTUK LARK) ===
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// === WEBHOOK DARI LARK ===
app.post("/lark-webhook", (req, res) => {
    console.log("==== DATA DARI LARK ====");
    console.log(req.body);

    // Challenge response
    if (req.body.type === "url_verification") {
        return res.json({ challenge: req.body.challenge });
    }

    return res.json({ ok: true });
});

// === RUN SERVER ===
app.listen(3000, () => {
    console.log("Server berjalan di port 3000");
});
