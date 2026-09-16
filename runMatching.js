const { matchAgency } = require("./services/matcher");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from("agency_csv_forms").select("agency");
  const agencies = [...new Set(data.map(r => r.agency))];

  console.log(`Matching ${agencies.length} agencies...\n`);

  for (const agency of agencies) {
    try {
      await matchAgency(agency);
    } catch (err) {
      console.error(`Failed on ${agency}:`, err.message);
    }
  }
}

run();