const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const cheerio = require("cheerio");

const downloadFile = require("../services/downloader");

const URL = "https://www.sss.gov.ph/download-forms-and-electronic-applications/";

async function checkForms() {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle2" });
    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);
    const forms = [];

    $("a[href$='.pdf']").each((i, el) => {
      const link = $(el).attr("href");
      const name = $(el).text().trim() || link.split("/").pop();
      if (link) forms.push({ name, url: link });
    });

    console.log(`Found ${forms.length} forms:\n`);
    forms.forEach((form, index) => {
      console.log(`${index + 1}. ${form.name}`);
    });

    for (let form of forms) {
      console.log("Downloading:", form.name);
      await downloadFile(form.url);
    }

  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkForms();