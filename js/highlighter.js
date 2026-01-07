/***********************
 * GLOBAL STATE
 ***********************/
let registry = [];
let auditComplete = false;

/***********************
 * HELPERS
 ***********************/
function parseLines(input) {
  return [...new Set(input.split(/\n+/).map(v => v.trim()).filter(Boolean))];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/***********************
 * RESET
 ***********************/
function clearHighlights(root) {
  root.querySelectorAll("span.hl-brand, span.hl-keyword, span.hl-location")
    .forEach(s => s.replaceWith(document.createTextNode(s.textContent)));
}

/***********************
 * MATCH REGISTRATION
 ***********************/
function registerMatches(text, terms, type, occupiedRanges) {
  const matches = [];

  terms.forEach(term => {
    const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    let m;
    while ((m = rx.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;

      if (occupiedRanges.some(r => start < r.end && end > r.start)) return;

      matches.push({ type, term: m[0], start, end });
      occupiedRanges.push({ start, end });
    }
  });

  return matches;
}

/***********************
 * APPLY HIGHLIGHTS
 ***********************/
function render(contentEl, matches) {
  let html = contentEl.innerText;
  matches.sort((a, b) => b.start - a.start);

  matches.forEach(m => {
    const cls = `hl-${m.type}`;
    html =
      html.slice(0, m.start) +
      `<span class="${cls}">${html.slice(m.start, m.end)}</span>` +
      html.slice(m.end);
  });

  contentEl.innerHTML = html;
}

/***********************
 * MAIN AUDIT
 ***********************/
function runAudit() {
  const contentEl = document.getElementById("content");
  clearHighlights(contentEl);

  const text = contentEl.innerText;
  if (!text.trim()) return alert("Add content first");

  registry = [];
  const ranges = [];

  const brands = parseLines(document.getElementById("brand").value);
  const keywords = parseLines(document.getElementById("keywords").value);
  const locations = parseLines(document.getElementById("locations").value);

  registry.push(...registerMatches(text, brands, "brand", ranges));
  registry.push(...registerMatches(text, keywords, "keyword", ranges));
  registry.push(...registerMatches(text, locations, "location", ranges));

  render(contentEl, registry);

  document.getElementById("count-brand").textContent =
    registry.filter(r => r.type === "brand").length;
  document.getElementById("count-keyword").textContent =
    registry.filter(r => r.type === "keyword").length;
  document.getElementById("count-location").textContent =
    registry.filter(r => r.type === "location").length;

  auditComplete = true;
}

/***********************
 * EXPORT TO WORD
 ***********************/
function downloadWord() {
  if (!auditComplete) return alert("Run audit first");

  const content = document.getElementById("content").innerHTML;

  const html = `
  <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: Arial; font-size: 12pt; }
        h1 { font-size: 18pt; font-weight: bold; }
        h2 { font-size: 16pt; font-weight: bold; }
        h3 { font-size: 12pt; font-weight: bold; }
        p { font-size: 12pt; }
        .hl-brand { background:#c92d9a; color:#000; font-weight:bold; }
        .hl-keyword { background:#ebe538; color:#000; font-weight:bold; }
        .hl-location { background:#15f5f7; color:#000; font-weight:bold; }
      </style>
    </head>
    <body>${content}</body>
  </html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "signal-highlighted-content.doc";
  a.click();
}
