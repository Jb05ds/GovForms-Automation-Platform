const Fuse = require("fuse.js");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildFuseIndex(downloadedForms) {
  return new Fuse(downloadedForms, {
    keys: [
      { name: "form_name", weight: 0.7 },
      { name: "first_page_text", weight: 0.3 },
    ],
    includeScore: true,
    threshold: 0.6,
    ignoreLocation: true,
  });
}

async function matchAgency(agencyName) {
  console.log(`\n>>> Matching forms for ${agencyName}...`);

  const { data: csvForms, error: csvError } = await supabase
    .from("agency_csv_forms")
    .select("*")
    .eq("agency", agencyName);

  if (csvError) {
    console.error("Failed to load CSV forms:", csvError.message);
    return;
  }

  const { data: downloadedForms, error: formsError } = await supabase
    .from("form_hashes")
    .select("*")
    .eq("agency", agencyName)
    .in("extraction_status", ["success", "empty"]);

  if (formsError) {
    console.error("Failed to load downloaded forms:", formsError.message);
    return;
  }

  console.log(`${csvForms.length} CSV rows vs ${downloadedForms.length} downloaded forms`);

  if (downloadedForms.length === 0) {
    console.log("No downloaded forms to match against — skipping.");
    return;
  }

  const fuse = buildFuseIndex(downloadedForms);
  const results = [];

  for (const csvRow of csvForms) {
    const matches = fuse.search(csvRow.description);
    const best = matches[0];

    let status = "unmatched";
    let confidence = 0;
    let matchedForm = null;

    if (best) {
      confidence = Math.round((1 - best.score) * 100);
      matchedForm = best.item;
      status = confidence >= 95 ? "auto_matched" : confidence >= 75 ? "needs_review" : "unmatched";
    }

    results.push({
      agency: agencyName,
      csv_form_id: csvRow.id,
      csv_description: csvRow.description,
      form_hash_id: matchedForm?.id ?? null,
      matched_form_name: matchedForm?.form_name ?? null,
      matched_file_name: matchedForm?.file_name ?? null,
      confidence,
      status,
    });
  }

  const { error: upsertError } = await supabase
    .from("form_matches")
    .upsert(results, { onConflict: "csv_form_id" });

  if (upsertError) {
    console.error("Failed to save matches:", upsertError.message);
    return;
  }

  const autoCount = results.filter(r => r.status === "auto_matched").length;
  const reviewCount = results.filter(r => r.status === "needs_review").length;
  const unmatchedCount = results.filter(r => r.status === "unmatched").length;

  console.log(`✅ ${autoCount} auto-matched | 👀 ${reviewCount} need review | ❌ ${unmatchedCount} unmatched`);
}

module.exports = { matchAgency };