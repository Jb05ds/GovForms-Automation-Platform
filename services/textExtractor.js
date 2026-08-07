const fs = require("fs");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

async function extractText(filePath){
    try {
        if (filePath.endsWith(".pdf")) {
            const buffer = fs.readFileSync(filePath);
            const data = await pdf(buffer);

            return {
                text: data.text.slice(0, 3000),
                status: data.text.trim() ? "success" : "empty",
                type: "pdf"
            };
        }
        if (filePath.endsWith(".docx")) {
            const result = await mammoth.extractRawText({
                path: filePath
            });

            return {
                text: data.text.slice(0, 3000),
                status: data.text.trim() ? "success" : "empty",
                type: "pdf"
            };
        }

        return {
            text: "",
            status: "failed",
            type: "unknown"
        };

    } catch (err) {
        return {
            text: "",
            status: "failed",
            type: "unknown"
        };
    }
}

module.exports = extractText;