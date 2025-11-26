const express = require("express");
const app = express();

app.use(express.json());

// --- WEBHOOK UNTUK LARK ---
app.post("/lark-webhook", async (req, res) => {
  console.log("==== DATA DARI LARK ====");
  console.log(req.body);

  res.json({
    success: true,
    message: "Webhook berhasil diterima!",
    data: req.body
  });
});

// RUNNING PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server berjalan di port", PORT);
});
