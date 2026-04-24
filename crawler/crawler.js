const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const cheerio = require("cheerio");
const generateHash = require("../services/hasher");
const path = require("path");
const saveHash = require("../services/database");
const cron = require("node-cron");
const sources = require("./sources");
const downloadFile = require("../services/downloader");

async function crawlAgency(agency) {
  console.log(`\n>>> Crawling ${agency.name}...`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(agency.url, { waitUntil: "networkidle2" });
  await randomDelay();
  const html = await page.content();
  await browser.close();

  const $ = cheerio.load(html);

  const forms = [];
  const seenUrls = new Set();

  $("a").each((i, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();

    if (!href) return;

    const fullUrl = href.startsWith("http")
      ? href
      : `${agency.baseUrl}/${href.replace(/^\//, "")}`;

    if (seenUrls.has(fullUrl)) return;
    if (!fullUrl.includes(".pdf")) return;

    seenUrls.add(fullUrl);
    forms.push({ name: text || fullUrl.split("/").pop(), url: fullUrl });
  });

  console.log(`Found ${forms.length} PDF forms for ${agency.name}`);

  for (let form of forms) {
    console.log(`Downloading: ${form.name}`);
    await downloadFile(form.url);

    const fileName = form.url.split("/").pop();
    const filePath = path.join(__dirname, "../downloads", fileName);

    const hash = generateHash(filePath);
    await saveHash(agency.name, form.name, fileName, hash, form.url);
  }

  console.log(`>>> Done with ${agency.name}`);
  return { formsFound: forms.length };
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

if (require.main === module) {
  console.log("crawler is starting");
  checkForms();

  cron.schedule("*/10 * * * *", () => {
    console.log("Scheduled Crawler Successful");
    checkForms();
  });
}


function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => 
    setTimeout(resolve, Math.floor(Math.random() * (max - min) + min))
  );
}

module.exports = { crawlAgency };