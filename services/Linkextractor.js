
function resolveAnchors(anchors) {
  const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
  const isFileName = (t) => /\.(pdf|docx?|doc?|xlsx?|pptx?)/i.test(t);
  const isGeneric = (t) => {
    const lower = t.toLowerCase();
    if (["download", "details", "click here", "preview", "view", "open", ""].includes(lower)) return true;
    if (/^\w+day,\s+\w+\s+\d{1,2},\s+\d{4}/.test(t)) return true; // "Wednesday, September 23, 2026, ..."
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(t)) return true;
    return false;
  };
  const usable = (t) => t && !isGeneric(t) && !isFileName(t) && t.length > 5 && t.length < 200;

  const looksLikeCode = (t) => /\d/.test(t) && t.length <= 40 && !/[a-z]{4,}/.test(t);

  return anchors.map((a) => {
    const linkText = clean(a.innerText);
    let name = linkText;
    const weak = !linkText || isFileName(linkText) || isGeneric(linkText);

    if (weak) {

      let container = a.closest("tr, li, div, td");
      for (let hops = 0; container && hops < 3 && name === linkText; hops++, container = container.parentElement) {
        for (const other of container.querySelectorAll("a")) {
          const t = clean(other.innerText);
          if (usable(t)) { name = t; break; }
        }
        if (name === linkText && container.tagName === "TR") {
          for (const cell of container.querySelectorAll("td, th")) {
            if (cell.contains(a)) continue;
            const t = clean(cell.innerText);
            if (usable(t)) { name = t; break; }
          }
        }
      }

      if (name === linkText) {
        let node = a;
        for (let depth = 0; node && depth < 6 && name === linkText; depth++, node = node.parentElement) {
          let sib = node.previousElementSibling;
          while (sib && !clean(sib.innerText)) sib = sib.previousElementSibling;
          if (!sib) continue;
          const t = clean(sib.innerText);
          if (usable(t) && !sib.querySelector("a")) name = t;
        }
      }
    } else if (looksLikeCode(linkText)) {

      const box = a.closest("li, tr, p");
      if (box && box.querySelectorAll("a").length === 1) {
        const rest = clean(clean(box.innerText).replace(linkText, "")).replace(/^[-\u2013\u2014:|\s]+/, "");
        if (rest.length > 5 && !isGeneric(rest)) name = `${linkText} \u2013 ${rest.slice(0, 160)}`;
      }
    }

    return { url: a.href, name };
  });
}

async function extractAnchors(page) {
  return page.$$eval("a", resolveAnchors);
}

module.exports = { extractAnchors, resolveAnchors };