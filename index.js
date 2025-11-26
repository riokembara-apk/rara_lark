import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// === WEBHOOK DARI LARK ===
app.post("/lark-webhook", (req, res) => {
    console.log("==== DATA LARK ====");
    console.log(req.body);

    // Challenge verification
    if (req.body.type === "url_verification") {
        return res.json({ challenge: req.body.challenge });
    }

    res.json({ ok: true });
});

// DEFAULT
app.get("/", (req, res) => {
    res.send("Rara Lark Webhook OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server berjalan di port", PORT);
});
