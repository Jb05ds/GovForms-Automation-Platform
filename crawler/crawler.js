const axios = require("axios");
const cheerio = require("cheerio");

const downloadFile = require("../services/downloader");
const URL = "https://afab.gov.ph/";

async function checkForms() {
  try {
    const response = await axios.get(URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      }
    });
    const html = response.data;

    const $ = cheerio.load(html);

    const forms = [];

    $("a").each((i, el) => {
      const link = $(el).attr("href");

      if (link && link.endsWith(".pdf")) {
        const fullUrl = link.startsWith("http") ? link : `https://afab.gov.ph${link}`;
        forms.push(fullUrl);
      }

    });

  for (let link of forms) {

    console.log("Downloading:", link);

    await downloadFile(link);

  }

    console.log("Found forms:\n");

    forms.forEach((form, index) => {
      console.log(`${index + 1}. ${form}`);
    });

  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkForms();