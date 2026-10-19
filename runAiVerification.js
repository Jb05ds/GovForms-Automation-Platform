const path = require("path");
const { createRanker } = require("./services/scoring");
const { verifyWithAI } = require("./services/aiVerifier");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function runAiVerification(agencyName) {
  console.log(
    `\n>>> AI-verifying needs_review matches for ${agencyName}...`
  );

  try {
    const reviewRows = await fetchAllRows(() =>
      supabase
        .from("form_matches")
        .select("*")
        .eq("agency", agencyName)
        .eq("status", "needs_review")
        .is("ai_verdict", null)
    );

    console.log(`${reviewRows.length} rows need AI verification`);

    if (reviewRows.length === 0) {
      return;
    }

    const downloadedForms = await fetchAllRows(() =>
      supabase
        .from("form_hashes")
        .select("*")
        .eq("agency", agencyName)
        .in("extraction_status", ["success", "empty"])
    );

    if (downloadedForms.length === 0) {
      console.log("No downloaded forms available for verification.");
      return;
    }

    const rank = createRanker(downloadedForms);

    for (const row of reviewRows) {
      const candidates = rank(row.csv_description || "", 3).map(
        (result) => result.form
      );

      if (candidates.length === 0) {
        console.log(
          `No candidates for "${row.csv_description}" — skipping`
        );
        continue;
      }

      try {
        const result = await verifyWithAI(
          row.csv_description,
          candidates
        );

        const update = {
          ai_verdict: result.verdict,
          ai_confidence: result.confidence,
          ai_reasoning: result.reasoning,
        };

        if (result.verdict === "matched") {
          const matched = candidates[result.matchedIndex];

          if (!matched) {
            console.error(
              `Invalid matchedIndex for "${row.csv_description}"`
            );
            continue;
          }

          update.status = "ai_matched";
          update.form_hash_id = matched.id;
          update.matched_form_name = matched.form_name;
          update.matched_file_name = matched.file_name;
        } else {
          update.status = "unmatched";
        }

        const { error: updateError } = await supabase
          .from("form_matches")
          .update(update)
          .eq("id", row.id);

        if (updateError) {
          console.error(
            `Failed to update row ${row.id}:`,
            updateError.message
          );
        } else {
          console.log(
            `"${row.csv_description}" -> ${result.verdict} (${result.confidence})`
          );
        }
      } catch (err) {
        console.error(
          `AI call failed for "${row.csv_description}":`,
          err.message
        );
      }

      await delay(2500);
    }

    console.log(`>>> Done AI-verifying ${agencyName}`);
  } catch (error) {
    console.error(
      `AI verification failed for ${agencyName}:`,
      error.message
    );
  }
}

module.exports = { runAiVerification };

if (require.main === module) {
  const agencyName =
    process.argv[2] || "Insurance Commission (IC)";

  runAiVerification(agencyName);
}