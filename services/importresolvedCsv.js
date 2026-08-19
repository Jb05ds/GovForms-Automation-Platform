const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importResolvedCsv(csvFilePath) {
  const fileContent = fs.readFileSync(csvFilePath, "utf-8");
  const rows = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`Parsed ${rows.length} rows from ${csvFilePath}`);

  const skipped = rows.filter(r => !r.agency || !r.description);
  const inserts = rows
    .filter(r => r.agency && r.description)
    .map(r => ({
      agency: r.agency,
      description: r.description,
      raw_row: r,
    }));

  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} rows with no resolved agency (see the unresolved list from resolve_agencies.py)`);
  }

  const BATCH_SIZE = 500;
  let imported = 0;
  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("agency_csv_forms").insert(batch);
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      continue;
    }
    imported += batch.length;
    console.log(`Imported ${imported} / ${inserts.length}...`);
  }

  console.log(`Done — ${imported} rows imported.`);
}

module.exports = { importResolvedCsv };