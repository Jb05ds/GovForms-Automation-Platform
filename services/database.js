require("dotenv").config({ 
  path: require("path").resolve(__dirname, "../.env") 
});

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient (
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function saveHash(agency, formName, fileName, hash, sourceUrl){
    const {data: existing} = await supabase
        .from("form_hashes")
        .select("hash")
        .eq("source_url", sourceUrl)
        .single();

    const isNew = !existing;
    const isChanged = existing ? existing.hash !== hash : false;

    if(isChanged) {
        console.log(`CHANGE DETECTED: ${formName}`)
    }

    if(isNew) {
        console.log (`NEW FORM DETECTED: ${formName}`)
    }

    const { error } = await supabase
        .from("form_hashes")
        .upsert({
            agency,
            form_name: formName,
            file_name: fileName,
            hash,
            source_url: sourceUrl,
            last_checked: new Date().toISOString(),
            is_changed: isChanged
        }, {
            onConflict: "source_url"
        });
    
    if(error) {
        console.error("database error", error.message)
    } else {
        console.log(`saved to DB: ${formName}`)
    }
}

async function getSources() {
  console.log("Fetching sources from Supabase...");
  
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("active", true)
    
  if (error) {
    console.error("Error fetching sources:", error.message);
    return [];
  }

  return data.map(row => ({
    name: row.agency_name,
    url: row.source_url,
    baseUrl: new URL(row.source_url).origin,
    crawl_status: row.crawl_status,
  }));
}

module.exports = { saveHash, getSources };