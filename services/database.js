require("dotenv").config({ 
  path: require("path").resolve(__dirname, "../.env") 
});

console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY ? "loaded" : "missing");

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient (
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function saveHash(agency, formName, fileName, hash, sourceUrl){
    const {data: existing} = await supabase
        .from("form_hashes")
        .select("hash")
        .eq("source_url", sourceUrl)
        .single();

    const isChanged = existing ? existing.hash !== hash : false;

    if(isChanged) {
        console.log(`CHANGE DETECTED: ${formName}`)
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

module.exports = saveHash;