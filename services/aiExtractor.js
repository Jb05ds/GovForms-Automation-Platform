const Groq = require("groq-sdk");

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function extractPDFLinks(links, baseUrl) {
  console.log(`Asking AI to find PDF links from ${baseUrl}...`);

  const response = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "user",
        content: `Here are all the links found on a Philippine government website (${baseUrl}).

Which ones are links to downloadable PDF forms?
Return ONLY a valid JSON array, no explanation, no markdown, like this:
[{"name": "Form Name", "url": "https://full-url.pdf"}]

If a URL is relative (like /downloads/form.pdf), convert it to full URL using the base: ${baseUrl}
If url has no extension but is clearly a form, include it anyway.
If nothing looks like a PDF form, return an empty array: []

Links:
${JSON.stringify(links, null, 2)}`
      }
    ]
  });

  try {
    const text = response.choices[0].message.content;
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.error("AI response parsing failed:", err.message);
    return [];
  }
}

module.exports = extractPDFLinks;