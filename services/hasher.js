const fs = require("fs");
const crypto = require("crypto");

function generateHash(filePath) {

    const fileBuff = fs.readFileSync(filePath);

    const hasher = crypto.createHash("sha256");

    hasher.update(fileBuff);

    const hash = hasher.digest("hex");

    return hash;
}

module.exports = generateHash;
