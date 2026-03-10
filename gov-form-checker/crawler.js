const axios = require("axios");
const cheerio = require("cheerio");

const URL = "https://www.sss.gov.ph/sss-annual-reports/";

async function checkForms() {
  try {
    const response = await axios.get(URL);
    const html = response.data;

    const $ = cheerio.load(html);

    const forms = [];

    $("a").each((i, el) => {
      const link = $(el).attr("href");

      if (link && link.endsWith(".pdf")) {
        forms.push(link);
      }
    });

    console.log("Found forms:\n");

    forms.forEach((form, index) => {
      console.log(`${index + 1}. ${form}`);
    });

  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkForms();