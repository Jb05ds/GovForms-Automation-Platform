const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importAgencyCsv(agencyName, csvFilePath, descriptionColumn = "description") {
  const fileContent = fs.readFileSync(csvFilePath, "utf-8");

  const rows = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Parsed ${rows.length} rows from ${csvFilePath}`);

  if (rows.length > 0 && !(descriptionColumn in rows[0])) {
    console.error(
      `Column "${descriptionColumn}" not found. Available columns: ${Object.keys(rows[0]).join(", ")}`
    );
    return { imported: 0 };
  }

  const inserts = rows
    .filter(row => row[descriptionColumn] && row[descriptionColumn].trim())
    .map(row => ({
      agency: agencyName,
      description: row[descriptionColumn].trim(),
      raw_row: row,
    }));

  const { error } = await supabase.from("agency_csv_forms").insert(inserts);

  if (error) {
    console.error("CSV import error:", error.message);
    return { imported: 0 };
  }

  console.log(`Imported ${inserts.length} rows for ${agencyName}`);
  return { imported: inserts.length };
}

module.exports = { importAgencyCsv };