require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { crawlAgency } = require("./crawler/crawler");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); //

const jobs = {};

app.post("/crawl", async (req, res) => {
  const { name, url, baseUrl } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const jobId = Date.now().toString();
  jobs[jobId] = { status: "running", result: null, error: null };

  res.json({ jobId });

  crawlAgency({ name, url, baseUrl })
    .then(result => {
      jobs[jobId] = { status: "done", result, error: null };
    })
    .catch(error => {
      jobs[jobId] = { status: "error", result: null, error: error.message };
    });
});

app.get("/status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});