const express = require("express");
const cors = require("cors");
const { crawlAgency } = require("./crawler/crawler");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/crawl", async (req, res) => {
  const { name, url, baseUrl } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    console.log(`\nReceived crawl request for: ${url}`);
    const result = await crawlAgency({ name, url, baseUrl });
    res.json({ success: true, message: `Crawl complete for ${name}`, result });
  } catch (error) {
    console.error("Crawl error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});