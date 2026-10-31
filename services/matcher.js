const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { createRanker } = require("./scoring");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchAllRows(buildQuery) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let page = 0;

  while (true) {
    const { data, error } = await buildQuery().range(
      page * PAGE_SIZE,
      (page + 1) * PAGE_SIZE - 1
    );

    if (error) {
      throw error;
    }

    const pageRows = data ?? [];
    allRows = allRows.concat(pageRows);

    if (pageRows.length < PAGE_SIZE) {
      break;
    }

    page++;
  }

  return allRows;
}

async function matchAgency(agencyName) {
  console.log(`\n>>> Matching forms for ${agencyName}...`);

  try {
    const csvForms = await fetchAllRows(() =>
      supabase
        .from("agency_csv_forms")
        .select("*")
        .eq("agency", agencyName)
    );

    const downloadedForms = await fetchAllRows(() =>
      supabase
        .from("form_hashes")
        .select("*")
        .eq("agency", agencyName)
        .in("extraction_status", ["success", "empty"])
    );

    console.log(
      `${csvForms.length} CSV rows vs ${downloadedForms.length} downloaded forms`
    );

    if (csvForms.length === 0) {
      console.log("No CSV forms found for this agency. Skipping.");
      return;
    }

    if (downloadedForms.length === 0) {
      console.log("No downloaded forms to match against. Skipping.");
      return;
    }

    const resolvedForms = await fetchAllRows(() =>
      supabase
        .from("form_matches")
        .select("csv_form_id")
        .eq("agency", agencyName)
        .not("ai_verdict", "is", null)
    );

    const alreadyResolved = new Set(
      resolvedForms.map((row) => row.csv_form_id)
    );

    console.log(
      `${alreadyResolved.size} CSV forms already have AI verdicts.`
    );

    const rank = createRanker(downloadedForms);
    const results = [];
    let skippedAiResolved = 0;

    for (const csvRow of csvForms) {
      if (alreadyResolved.has(csvRow.id)) {
        skippedAiResolved++;
        continue;
      }

      const [best] = rank(csvRow.description || "", 1);

      let status = "unmatched";
      let confidence = 0;
      let matchedForm = null;

      if (best) {
        confidence = best.confidence;
        matchedForm = best.form;

        if (confidence >= 95) {
          status = "auto_matched";
        } else if (confidence >= 35) {
          status = "needs_review";
        }
      }

      results.push({
        agency: agencyName,
        csv_form_id: csvRow.id,
        csv_description: (csvRow.description || "").trim(),
        form_hash_id: matchedForm?.id ?? null,
        matched_form_name: matchedForm?.form_name ?? null,
        matched_file_name: matchedForm?.file_name ?? null,
        confidence,
        status,
      });
    }

    console.log(`Forms skipped (already AI-resolved): ${skippedAiResolved}`);
    console.log(`New matching results to save: ${results.length}`);

    if (results.length === 0) {
      console.log("No new matching results to save.");
      return;
    }

    const UPSERT_BATCH_SIZE = 500;
    let saved = 0;

    for (let i = 0; i < results.length; i += UPSERT_BATCH_SIZE) {
      const batch = results.slice(i, i + UPSERT_BATCH_SIZE);

      const { error } = await supabase
        .from("form_matches")
        .upsert(batch, { onConflict: "csv_form_id" });

      if (error) {
        throw new Error(
          `Failed to save batch ${
            Math.floor(i / UPSERT_BATCH_SIZE) + 1
          }: ${error.message}`
        );
      }

      saved += batch.length;

      console.log(`Saved ${saved} / ${results.length} matching results.`);
    }

    const autoCount = results.filter(
      (row) => row.status === "auto_matched"
    ).length;

    const reviewCount = results.filter(
      (row) => row.status === "needs_review"
    ).length;

    const unmatchedCount = results.filter(
      (row) => row.status === "unmatched"
    ).length;

    console.log("\nMatching complete.");
    console.log(`Auto-matched: ${autoCount}`);
    console.log(`Needs review: ${reviewCount}`);
    console.log(`Unmatched: ${unmatchedCount}`);
    console.log(`Successfully saved: ${saved}`);
  } catch (error) {
    console.error(`Matching failed for ${agencyName}:`, error.message);
    throw error;
  }
}

module.exports = { matchAgency };