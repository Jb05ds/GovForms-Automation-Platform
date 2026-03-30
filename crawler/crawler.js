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

  const URL = "https://www.sss.gov.ph/download-forms-and-electronic-applications/";

  async function crawlAgency(agency) {
    console.log(`\n>>> Crwaling ${agency.name}...`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(agency.url, { waitUntil: "networkidle2" });
    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);
    const forms = [];

    $(agency.selector).each((i, el) => {
      const link = $(el).attr("href");
      const name = $(el).text().trim() || link.split("/").pop();

      if(link) {
        const fullUrl = link.startsWith("http")
        ? link
        : `${agency.baseUrl}/${link.replace(/^\//, "")}`

        forms.push({name, url: fullUrl});
      }
    })

    console.log(`Found ${forms.length} forms for ${agency.name}`);

    for(let form of forms) {
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
    console.log(`\n[${new Date().toLocaleString()}] Starting crawrl for all agencies...`);   

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

  cron.schedule("*/1 * * * *", () => {
    console.log("Scheduled Crawler Successful");
    checkForms();
  })