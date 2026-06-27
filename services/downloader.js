const https = require("https");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function downloadFile(url, fileName) {
  try {

    const filePath = path.join(__dirname, "../downloads", fileName);

    const response = await axios({
    url: url,
    method: "GET",
    responseType: "stream",
    timeout: 30000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    });

    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log("Downloaded:", fileName);
        resolve();
      });

      writer.on("error", (err) => {
        writer.close();
        reject(err);
      });
    });

  } catch (error) {
    console.error("Download error:", error.message);
    throw error;
  }
}

module.exports = downloadFile;