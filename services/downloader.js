const https = require("https");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

function validateDownloadFile(filePath, fileName) {
  const buffer = fs.readFileSync(filePath);
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf") { 
    const signature = buffer.slice(0, 5).toString("ascii");
    if (signature !== "%PDF-") {
      throw new Error(`Downloaded file is not a valid PDF (signature: ${JSON.stringify(signature)})`);
    }
  }

  if (extension === ".docx" || extension === ".xlsx" || extension === ".pptx") {

    const isZip = buffer.length >= 4 &&
      buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZip) {
      const signature = buffer.slice(0, 15).toString("ascii");
      throw new Error(`Downloaded file is not a valid ${extension} (expected ZIP signature, got: ${JSON.stringify(signature)})`);
    }
  }

  if (extension === ".doc" || extension === ".xls" || extension === ".ppt") {

    const oleSignature = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    const isOle = buffer.length >= 8 && oleSignature.every((byte, i) => buffer[i] === byte);
    if (!isOle) {
      const signature = buffer.slice(0, 15).toString("ascii");
      throw new Error(`Downloaded file is not a valid ${extension} (expected OLE signature, got: ${JSON.stringify(signature)})`);
    }
  }

  return true;
}

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
        try {
          validateDownloadFile(filePath, fileName);

          console.log("Downloaded:", fileName);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      writer.on("error", (err) => {
        reject(err);
      });
    });

  } catch (error) {
    console.error("Download error:", error.message);
    throw error;
  }
}

module.exports = {
  downloadFile,
  validateDownloadFile,
};