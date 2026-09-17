const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { matchAgency } = require("./services/matcher");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getAllAgencies() {
  const PAGE_SIZE = 1000;
  const agencies = new Set();
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from("agency_csv_forms")
      .select("agency")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    data.forEach(r => agencies.add(r.agency));
    if (!data || data.length < PAGE_SIZE) break;
    page++;
  }

  return [...agencies];
}

async function run() {
  const agencies = await getAllAgencies();
  console.log(`Discovered ${agencies.length} agencies in agency_csv_forms\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const agency of agencies) {
    try {
      const result = await matchAgency(agency);
      processed++;
    } catch (err) {
      console.error(`Failed on ${agency}:`, err.message);
      failed++;
    }
  }

  console.log(`\n=== Run complete ===`);
  console.log(`Agencies attempted: ${agencies.length} | errors: ${failed}`);
}

run();