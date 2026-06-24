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
  headless: false,
  userDataDir: "./browser-session",
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
  const pageTitle = await page.title();
  console.log("Page title:", pageTitle);

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
    const googleDocPattern = /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/;
    const googleDrivePattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;

    const blockedKeywords = [
      "guideline", "guidelines", "manual", "circular", "charter",
      "annual report", "infographic", "poster", "memorandum",
      "brochure", "faq", "faqs", "bulletin", "advisory",
      "handbook", "primer", "newsletter", "press release",
      "executive order", "republic act", "implementing rules",
      "citizen's charter", "citizens charter", "privacy notice",
      "privacy policy", "terms", "annual", "report", "law",
      "reminder", "reminders", "guide", "implementation guide",
      "overview", "infographic", "checklist of requirements",
    ];

    if (seenUrls.has(fullUrl)) continue;
    //if (!fullUrl.startsWith(agency.baseUrl)) continue;

    if (
      fullUrl.toLowerCase().includes(".pdf") ||
      fullUrl.toLowerCase().includes(".docx") ||
      fullUrl.includes("drive.google.com/uc?export=download") ||
      googleDocPattern.test(fullUrl) ||
      googleDrivePattern.test(fullUrl)
    ) {
      seenUrls.add(fullUrl);

      const linkName = (link.name && link.name !== "Download" && link.name !== "")
      ? link.name
      : decodeURIComponent(fullUrl.split("/").pop());

      const isBlocked = blockedKeywords.some(keyword =>
        linkName.toLowerCase().includes(keyword)
      );

      if (isBlocked) {
        console.log(`[SKIPPED] ${linkName}`);
        continue;
      }

      forms.push({
        name: linkName,
        url: convertGoogleUrl(fullUrl)
      });
    }
  }

  console.log(`Found ${forms.length} PDF forms for ${agency.name}`);

  for (let form of forms) {
    console.log(`Downloading: ${form.name}`);
    try {
      await downloadFile(form.url);
    } catch (err) {
      console.log(`[DOWNLOAD FAILED] ${form.name}: ${err.message}`);
      continue;
    }

    const fileName = decodeURIComponent(form.url.split("/").pop());
    const filePath = path.join(__dirname, "../downloads", fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`[SKIPPED HASH] File not found after download: ${fileName}`);
      continue;
    }
    
    try {
      const hash = generateHash(filePath);
      await saveHash(agency.name, form.name, fileName, hash, form.url);
    } catch (err) {
      console.error(`Failed to save hash for ${form.name}:`, err.message);
    }

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

  //putting this on timeout for now since i dont need it yet
//  cron.schedule("*/30 * * * *", () => {
//    console.log("Scheduled Crawler Successful");
//    checkForms();
//  });
}


function randomDelay(min = 4000, max = 6000) {
  return new Promise(resolve => 
    setTimeout(resolve, Math.floor(Math.random() * (max - min) + min))
  );
}

function convertGoogleUrl(url) {
  const docMatch = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);

  if (docMatch) {
    const [, type, id] = docMatch;
    const exportFormat = type === "spreadsheets" ? "xlsx" : type === "presentation" ? "pptx" : "docx";
    return `https://docs.google.com/${type}/d/${id}/export?format=${exportFormat}`;
  }

  if (driveMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }

  return url;
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