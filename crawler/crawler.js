const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const cheerio = require("cheerio");
const generateHash = require("../services/hasher");
const path = require("path");
const saveHash = require("../services/database");
const cron = require("node-cron");
const sources = require("./sources");
const extractPDFLinks = require("../services/aiExtractor");
const downloadFile = require("../services/downloader");

async function crawlAgency(agency) {
  console.log(`\n>>> Crawling ${agency.name}...`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(agency.url, { waitUntil: "networkidle2" });
  const html = await page.content();
  await browser.close();

  const $ = cheerio.load(html);

  const links = $("a").map((i, el) => ({
    text: $(el).text().trim(),
    href: $(el).attr("href")
  })).get().filter(l => 
    l.href && 
    l.href.trim() !== "" &&
    (
      l.href.includes(".pdf") ||
      l.href.includes("download") ||
      l.href.includes("form") ||
      l.href.includes("forms") ||
      l.text.toLowerCase().includes("form") ||
      l.text.toLowerCase().includes("download")
    )
  );

  console.log(`Found ${links.length} total links, asking AI...`);

  const forms = await extractPDFLinks(links, agency.baseUrl);

  console.log(`AI found ${forms.length} PDF forms for ${agency.name}`);

  for (let form of forms) {
    console.log(`Downloading: ${form.name}`);
    await downloadFile(form.url);

    const fileName = form.url.split("/").pop();
    const filePath = path.join(__dirname, "../downloads", fileName);

    const hash = generateHash(filePath);
    await saveHash(agency.name, form.name, fileName, hash, form.url);
  }

  console.log(`>>> Done with ${agency.name}`);
}

async function checkForms() {
  console.log(`\n[${new Date().toLocaleString()}] Starting crawl for all agencies...`);

  for (let agency of sources) {
    try {
      await crawlAgency(agency);
    } catch (error) {
      console.log(`error crawling ${agency.name}:`, error.message);
    }
  }

  console.log(`\n[${new Date().toLocaleString()}] All agencies done!`);
}

console.log("crawler is starting");
checkForms();

cron.schedule("*/10 * * * *", () => {
  console.log("Scheduled Crawler Successful");
  checkForms();
});