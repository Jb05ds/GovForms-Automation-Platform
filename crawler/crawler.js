require("dotenv").config({ 
  path: require("path").resolve(__dirname, "../.env") 
});


const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const generateHash = require("../services/hasher");
const path = require("path");
const {saveHash, getSources} = require("../services/database");
const cron = require("node-cron");
const fs = require("fs");
const downloadFile = require("../services/downloader");

const downloadsDir = path.join(__dirname, "../downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
  console.log("Created downloads folder");
}


async function crawlAgency(agency) {
  console.log(`\n>>> Crawling ${agency.name}...`);

  const browser = await puppeteer.launch({
  headless: true,
  ignoreHTTPSErrors: true,
  args: [
    "--ignore-certificate-errors",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process"
  ]
  });

  const page = await browser.newPage(); 
  page.on("requestfailed", request => {
  console.log("FAILED:", request.url(), request.failure()?.errorText);
  });
  
  await page.setBypassCSP(true);

  await safeGoto(page, agency.url);
  await randomDelay();
  try {
  await page.waitForSelector('.accordion-body', { timeout: 5000 });
  } catch(e) {
    console.log('No accordion found, continuing...');
  }
  await page.waitForSelector("a[href]", { timeout: 10000 });

  const links = await page.$$eval("a", anchors =>
    anchors.map(a => ({
      url: a.href,
      name: a.innerText.trim()
    }))
  );

  await browser.close();

  const forms = [];
  const seenUrls = new Set();

  for (let link of links) {
    if (!link.url) continue;

    const fullUrl = new URL(link.url, agency.baseUrl).href;

    if (seenUrls.has(fullUrl)) continue;
    if (!fullUrl.startsWith(agency.baseUrl)) continue;

    if (
      fullUrl.toLowerCase().includes(".pdf") ||
      fullUrl.toLowerCase().includes(".docx") ||
      fullUrl.includes("drive.google.com/uc?export=download")
    ) {
      seenUrls.add(fullUrl);

      forms.push({
        name: (link.name && link.name !== "Download" && link.name !== "") 
          ? link.name 
          : decodeURIComponent(fullUrl.split("/").pop()),
        url: fullUrl
      });
    }
  }

  console.log(`Found ${forms.length} PDF forms for ${agency.name}`);

  for (let form of forms) {
    console.log(`Downloading: ${form.name}`);
    await downloadFile(form.url);

    const fileName = decodeURIComponent(form.url.split("/").pop());
    const filePath = path.join(__dirname, "../downloads", fileName);

    const hash = generateHash(filePath);
    await saveHash(agency.name, form.name, fileName, hash, form.url);
  }

  console.log(`>>> Done with ${agency.name}`);
  return { formsFound: forms.length };
}

async function checkForms() {
  console.log(`\n[${new Date().toLocaleString()}] Starting crawl for all agencies...`);

  const sources = await getSources();
  console.log(`Loaded ${sources.length} sources from database`);

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

async function safeGoto(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (err) {
    console.log("HTTPS failed, trying HTTP...");

    const httpUrl = url.replace("https://", "http://");
    await page.goto(httpUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  }
}

module.exports = { crawlAgency };