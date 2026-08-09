require("dotenv").config({ 
  path: require("path").resolve(__dirname, "../.env") 
});


const puppeteer = require("puppeteer-extra");
const cheerio = require("cheerio");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const { Camoufox } = require("camoufox-js");
const generateHash = require("../services/hasher");
const path = require("path");
const {saveHash, getSources} = require("../services/database");
const cron = require("node-cron");
const fs = require("fs");
const { downloadFile, validateDownloadFile} = require("../services/downloader");
const extractText = require("../services/textExtractor");
const fetch = require("node-fetch");

const downloadsDir = path.join(__dirname, "../downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
  console.log("Created downloads folder");
}


async function crawlAgency(agency) {
  console.log(`\n>>> Crawling ${agency.name}...`);

  let links = [];
  let camoufoxBrowser = null;
  let camoufoxContext = null;

  if (agency.crawl_status === "cloudflare") {
    console.log(`Using ScraperAPI for CF-protected site...`);
    const html = await fetchWithScraperAPI(agency.url);
    if (!html) {
      console.log(`[SCRAPER API FAILED] No HTML returned for ${agency.name}`);
      return { formsFound: 0 };
    }
    links = extractLinksFromHTML(html, agency.url);
  } else if (agency.crawl_status === "puppeteer_only") {
    console.log(`Using Puppeteer with manual CF solve...` );
    links = await extractLinksWithPuppeteer(agency, true);
  } else if (agency.crawl_status === "playwright") {
    console.log("Using playwright + Camoufox...")
    const result = await extractLinksWithCamoufox(agency, false);
    links = result.links;
    camoufoxBrowser = result.browser;
    camoufoxContext = result.context;
    
  } else {
    links = await extractLinksWithPuppeteer(agency);
  }

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
      fullUrl.toLowerCase().includes(".doc") ||
      fullUrl.toLowerCase().includes(".xlsx") ||
      fullUrl.toLowerCase().includes(".xls") ||
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

try {
  for (let form of forms) {
  console.log(`Downloading: ${form.name}`);

  const fileName = getFileName(form);

  try {
    if (agency.crawl_status === "cloudflare") {
      await downloadFileWithScraperAPI(form.url, fileName);
    } else if (agency.crawl_status === "playwright" && camoufoxContext) {
      await downloadFileWithContext(camoufoxContext, form.url, fileName);
    } else {
      await downloadFile(form.url, fileName);
    }
  } catch (err) {
    console.log(`[DOWNLOAD FAILED] ${form.name}: ${err.message}`);
    continue;
  }

    const filePath = path.join(__dirname, "../downloads", fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`[SKIPPED HASH] File not found after download: ${fileName}`);
      continue;
    }

    
    try {
      const hash = generateHash(filePath);
      const textExtract = await extractText(filePath);
      await saveHash(agency.name, form.name, fileName, hash, form.url, textExtract);
    } catch (err) {
      console.error(`Failed to save hash for ${form.name}:`, err.message);
    }

  }

} finally {
  if (camoufoxBrowser) {
    await camoufoxBrowser.close().catch(err => console.log("Error closing camoufox browser", err.message));
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
      console.error(error);
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

function getFileName(form) {
  const googleDocMatch = form.url.match(/\/d\/([a-zA-Z0-9_-]+)\/export\?format=(\w+)/);
  const googleDriveMatch = form.url.match(/id=([a-zA-Z0-9_-]+)/);

  if (googleDocMatch) {
    const [, id, ext] = googleDocMatch;
    return `${form.name.replace(/[^a-zA-Z0-9]/g, "_")}_${id}.${ext}`;
  }
  if (googleDriveMatch) {
    return `${form.name.replace(/[^a-zA-Z0-9]/g, "_")}_${googleDriveMatch[1]}.pdf`;
  }

  try {
    const parsed = new URL(form.url);
    const fileParam = parsed.searchParams.get("file");
    if (fileParam) {
      return decodeURIComponent(fileParam.split("/").pop());
    }
    const pathSegment = decodeURIComponent(parsed.pathname.split("/").pop());
    if (pathSegment && /\.(pdf|docx?|xlsx?|pptx?)$/i.test(pathSegment)) {
      return pathSegment;
    }
  } catch {
  
  }

  return decodeURIComponent(form.url.split("/").pop());
}

function extractLinksFromHTML(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let fullUrl;
    try {
      fullUrl = new URL(href, baseUrl).href;
    } catch {
      return;
    }

    const linkText = $(el).text().trim();
    let name = linkText;

    if (!linkText || /\.(pdf|docx?|xlsx?)$/i.test(linkText) || 
        ["click here", "download"].includes(linkText.toLowerCase())) {
      name = decodeURIComponent(href.split("/").pop()) || linkText;
    }

    links.push({ url: fullUrl, name });
  });

  return links;
}

async function extractLinksWithPuppeteer(agency, manual = false) {
  const isWindows = process.platform === "win32";

  const browser = await puppeteer.launch({
    headless: isWindows ? false : "new",
    ...(isWindows && { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }),
    userDataDir: "./browser-session",
    ignoreHTTPSErrors: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--dns-prefetch-disable",
      "--no-pings",
      "--disable-features=DnsOverHttps",
    ]
  });

  let links = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    page.on("requestfailed", request => {
      console.log("FAILED:", request.url(), request.failure()?.errorText);
    });
    await page.setBypassCSP(true);
    await safeGoto(page, agency.url);
    await waitForCloudflare(page, manual);
    await randomDelay();

    try {
      await page.waitForSelector('.accordion-body', { timeout: 5000 });
    } catch(e) {
      console.log('No accordion found, continuing...');
    }

    try {
      await page.waitForSelector("a[href]", { timeout: 15000 });
    } catch (e) {
      console.log("No links found within timeout — continuing with 0 links.");
    }

    console.log("Page title:", await page.title());

    links = await page.$$eval("a", anchors =>
      anchors.map(a => {
        const linkText = a.innerText.trim();
        let name = linkText;
        const looksLikeFileName = /\.(pdf|docx?|doc?|pptx?|xlsx?)$/i.test(linkText);
        if (!linkText || looksLikeFileName || linkText.toLowerCase() === "click here" || linkText.toLowerCase() === "download") {
          let container = a.closest("tr, li, div, td");
          let attempts = 0;
          while (container && attempts < 2) {
            const possibleLinks = Array.from(container.querySelectorAll("a"));
            for (const link of possibleLinks) {
              const text = link.innerText.trim();
              const isFilename = /\.(pdf|docx?|doc?|xlsx?|pptx?)/i.test(text);
              const isGeneric = ["download", "details", "click here","preview", "view", "open", ""].includes(text.toLowerCase());
              const looksLikeDate = /^\w+day,\s+\w+\s+\d{1,2},\s+\d{4}/.test(text) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text);
              if (text && !isFilename && !isGeneric && !looksLikeDate && text.length > 5 && text.length < 200) {
                name = text;
                break;
              }
            }
            if (name !== linkText) break;
            container = container.parentElement;
            attempts++;
          }
        }
        return { url: a.href, name };
      })
    );
  } finally {
    await browser.close().catch(err => console.log("Error closing browser:", err.message));
  }

  return links;
}

async function extractLinksWithCamoufox(agency, manual = false) {
  const browser = await Camoufox({
    headless: process.platform === "win32" ? false : true,
  });

  let links = [];
  let context;

  try {
    context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1366, height: 768 });
    page.on("requestfailed", request => {
      console.log("FAILED:", request.url(), request.failure()?.errorText);
    });

    await safeGotoPlaywright(page, agency.url);
    await waitForCloudflare(page, manual);
    await randomDelay();

    try {
      await page.waitForSelector('.accordion-body', { timeout: 5000 });
    } catch (e) {
      console.log('No accordion found, continuing...');
    }

    try {
      await page.waitForSelector("a[href]", { timeout: 15000 });
    } catch (e) {
      console.log("No links found within timeout — continuing with 0 links.");
    }

    console.log("Page title:", await page.title());

    links = await page.$$eval("a", anchors =>
      anchors.map(a => {
        const linkText = a.innerText.trim();
        let name = linkText;
        const looksLikeFileName = /\.(pdf|docx?|doc?|pptx?|xlsx?)$/i.test(linkText);
        if (!linkText || looksLikeFileName || linkText.toLowerCase() === "click here" || linkText.toLowerCase() === "download") {
          let container = a.closest("tr, li, div, td");
          let attempts = 0;
          while (container && attempts < 2) {
            const possibleLinks = Array.from(container.querySelectorAll("a"));
            for (const link of possibleLinks) {
              const text = link.innerText.trim();
              const isFilename = /\.(pdf|docx?|doc?|xlsx?|pptx?)/i.test(text);
              const isGeneric = ["download", "details", "click here", ""].includes(text.toLowerCase());
              if (text && !isFilename && !isGeneric && text.length > 5 && text.length < 200) {
                name = text;
                break;
              }
            }
            if (name !== linkText) break;
            container = container.parentElement;
            attempts++;
          }
        }
        return { url: a.href, name };
      })
    );
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }

  return { links, browser, context };
}

async function safeGotoPlaywright(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 }); 
  } catch (err) {
    console.log("Navigation failed, trying HTTP...");
    const httpUrl = url.replace("https://", "http://");
    await page.goto(httpUrl, { waitUntil: "networkidle", timeout: 120000 });
  }
}

async function fetchWithScraperAPI(url, retries = 3) {
  const API_KEY = process.env.SCRAPER_API_KEY;
  if (!API_KEY) throw new Error("SCRAPER_API_KEY not set in .env");

  for (let attempt = 1; attempt <= retries; attempt++) {

  const premium = attempt === retries ? "&premium=true" : "";

  const scraperUrl =
    `http://api.scraperapi.com?api_key=${API_KEY}&url=${encodeURIComponent(url)}&render=true&country_code=us&premium=true&retry=3`;

    try {
      console.log(`[SCRAPER API] Attempt ${attempt}/${retries}/${premium ? " (premium)": ""} for ${url}`);
      const response = await fetch(scraperUrl, { timeout: 60000 });
      if (!response.ok) {
        console.log(`[SCRAPER API] HTTP ${response.status} on attempt ${attempt}`);
        if (attempt < retries) {
          await randomDelay(3000, 6000);
          continue;
        }
        return null;
      }
      const html = await response.text();
      console.log(`[SCRAPER API] Got ${html.length} chars for ${url}`);
      return html;
    } catch (err) {
      console.log(`[SCRAPER API ERROR] Attempt ${attempt}: ${err.message}`);
      if (attempt < retries) await randomDelay(3000, 6000);
    }
  }

  return null;
}

async function downloadFileWithScraperAPI(url, fileName) {
  const API_KEY = process.env.SCRAPER_API_KEY;
  const scraperUrl = `http://api.scraperapi.com?api_key=${API_KEY}&url=${encodeURIComponent(url)}`;

  const response = await fetch(scraperUrl, { timeout: 60000 });

  if (!response.ok) {
    throw new Error(`Request failed with status code ${response.status}`);
  }

  const buffer = await response.buffer();

  if (path.extname(fileName).toLowerCase() === ".pdf") {
  const signature = buffer.slice(0, 5).toString("ascii");

  if (signature !== "%PDF-") {
    throw new Error("Downloaded file is not a valid PDF");
   } 
  }
  
  const filePath = path.join(__dirname, "../downloads", fileName);
  fs.writeFileSync(filePath, buffer);
  console.log(`[DOWNLOADED] ${fileName}`);
}

async function downloadFileWithContext(context, url, fileName) {
  const page = await context.newPage();
  const filePath = path.join(__dirname, "../downloads", fileName);

  const downloadPromise = page
    .waitForEvent("download", { timeout: 15000 })
    .catch(() => null);

  try {
    let response;

    try {
      response = await page.goto(url, { timeout: 30000 });
    } catch (err) {
      if (!/download is starting/i.test(err.message)) {
        throw err;
      }

      response = null;
    }

    if (response && response.ok()) {
      const buffer = await response.body();

      fs.writeFileSync(filePath, buffer);

      validateDownloadFile(filePath, fileName);

      console.log(`[DOWNLOADED] ${fileName}`);
      return;
    }

    const download = await downloadPromise;

    if (!download) {
      throw new Error(
        "Expected a file download but none arrived within timeout"
      );
    }

    await download.saveAs(filePath);

    validateDownloadFile(filePath, fileName);

    console.log(`[DOWNLOADED] ${fileName}`);

  } finally {
    await page.close().catch(() => {});
  }
}

async function safeGoto(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  } catch (err) {
    console.log("Navigation failed, trying HTTP...");
    const httpUrl = url.replace("https://", "http://");
    await page.goto(httpUrl, { waitUntil: "networkidle2", timeout: 30000 });
  }
}

async function waitForCloudflare(page, manual = false) {
  const title = await page.title();
  const isChallenge = title.includes("Just a moment") || title.includes("Attention Required");
  if (!isChallenge) return;

  const canPromptInteractively = manual && process.stdin.isTTY;

  if (canPromptInteractively) {
    console.log("\n⚠️  MANUAL ACTION REQUIRED");
    console.log(`   → Solve the Cloudflare challenge in the browser window`);
    console.log(`   → Then come back here and press ENTER to continue...\n`);
    await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", () => {
        process.stdin.pause();
        resolve();
      });
    });

    await page.waitForFunction(
      () => !document.title.includes("Just a moment") && !document.title.includes("Attention Required"),
      { timeout: 30000 }
    );
    await page.waitForLoadState?.("networkidle").catch(() => {});
    console.log("CF cleared! Page title:", await page.title());
    await randomDelay(2000, 3000);
  } else {
    console.log("Cloudflare challenge detected, waiting for auto-solve (non-interactive)...");
    try {
      await page.waitForFunction(
        () => !document.title.includes("Just a moment"),
        { timeout: 120000 }
      );
      console.log("✅ Cleared automatically. Page title:", await page.title());
      await randomDelay(2000, 4000);
    } catch {
      console.log("❌ Did not clear within 30s — continuing anyway.");
    }
  }
}


module.exports = { crawlAgency };