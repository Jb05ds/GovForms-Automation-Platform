const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const XLSX = require("xlsx");

async function extractText(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdf(buffer);

      return {
        text: data.text.slice(0, 3000),
        status: data.text.trim() ? "success" : "empty",
        type: "pdf",
      };
    }

    if (ext === ".docx") {
      const result = await mammoth.extractRawText({
        path: filePath,
      });

      return {
        text: result.value.slice(0, 3000),
        status: result.value.trim() ? "success" : "empty",
        type: "docx",
      };
    }

    if (ext === ".xls" || ext === ".xlsx") {
      const workbook = XLSX.readFile(filePath);

      let text = "";

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        text += XLSX.utils.sheet_to_csv(sheet);
        text += "\n";
      });

      return {
        text: text.slice(0, 3000),
        status: text.trim() ? "success" : "empty",
        type: ext.substring(1),
      };
    }

    if (ext === ".doc") {
      return {
        text: "",
        status: "unsupported",
        type: "doc",
      };
    }

    return {
      text: "",
      status: "unsupported",
      type: ext.replace(".", ""),
    };
  } catch (err) {
    console.error("Text extraction failed:", err.message);

    return {
      text: "",
      status: "failed",
      type: path.extname(filePath).replace(".", ""),
    };
  }
}

module.exports = extractText;