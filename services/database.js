require("dotenv").config();
require("dotenv").config({ 
  path: "C:\\Users\\rayma\\OneDrive\\Desktop\\gov-formChecker\\form-checker\\.env" 
});
    
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient (
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function saveHash(agency, formName, fileName, hash, sourceUrl){
    const {data: existing} = await supabase
        .from("form_hashes")
        .select("hash")
        .eq("file_name", fileName)
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
            onConflict: "file_name"
        });
    
    if(error) {
        console.error("database error", error.message)
    } else {
        console.log(`saved to DB: ${formName}`)
    }
}

module.exports = saveHash;