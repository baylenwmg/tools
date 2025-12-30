function parseList(input) {
  return [...new Set(
    input.split(/,|\n|\t/)
      .map(v => v.trim())
      .filter(Boolean)
  )];
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPattern(text) {
  return escapeRegExp(text)
    .split("")
    .map(c => /[a-zA-Z]/.test(c)
      ? `[${c.toLowerCase()}${c.toUpperCase()}]`
      : c
    )
    .join("");
}

function highlightAndTrack(html, list, cssClass) {
  let total = 0;
  const used = [];
  const unused = [];
  let updated = html;

  list.forEach(item => {
    const regex = new RegExp(`(${buildPattern(item)})`, "g");
    let found = false;

    updated = updated.replace(regex, match => {
      total++;
      found = true;
      return `<span class="${cssClass}">${match}</span>`;
    });

    found ? used.push(item) : unused.push(item);
  });

  return { updated, total, used, unused };
}

function getWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function highlightText() {
  document.getElementById("report").innerHTML = "";

  const brandInput = document.getElementById("brand").value;
  const keywordInput = document.getElementById("keywords").value;
  const locationInput = document.getElementById("locations").value;

  const editor = document.getElementById("content");
  const rawHTML = editor.innerHTML;
  const rawText = editor.innerText;

  if (!rawText.trim()) {
    alert("Please paste content first.");
    return;
  }

  const brands = parseList(brandInput);
  const keywords = parseList(keywordInput);
  const locations = parseList(locationInput);

  let content = rawHTML;

  const brandStats = highlightAndTrack(content, brands, "brand");
  content = brandStats.updated;

  const keywordStats = highlightAndTrack(content, keywords, "keyword");
  content = keywordStats.updated;

  const locationStats = highlightAndTrack(content, locations, "location");
  content = locationStats.updated;

  const wordCount = getWordCount(rawText);

  document.getElementById("output").innerHTML = content;

  renderReport(wordCount, brandStats, keywordStats, locationStats);
}

function renderReport(wordCount, brandStats, keywordStats, locationStats) {
  const report = `
    <h3>Summary</h3>
    <ul>
      <li><b>Word Count:</b> ${wordCount}</li>
      <li><b>Brand Usage:</b> ${brandStats.total} ${brandStats.total > 8 ? "⚠ Overused" : "✓ OK"}</li>
      <li><b>Keywords Used:</b> ${keywordStats.used.length} / ${keywordStats.used.length + keywordStats.unused.length}</li>
      <li><b>Locations Used:</b> ${locationStats.used.length} / ${locationStats.used.length + locationStats.unused.length}</li>
    </ul>

    <h3>Issues</h3>
    <ul>
      ${brandStats.unused.length ? `<li>Unused Brands: ${brandStats.unused.join(", ")}</li>` : ""}
      ${keywordStats.unused.length ? `<li>Unused Keywords: ${keywordStats.unused.join(", ")}</li>` : ""}
      ${locationStats.unused.length ? `<li>Missing Locations: ${locationStats.unused.join(", ")}</li>` : ""}
      ${brandStats.total > 8 ? `<li>Brand may be overused</li>` : ""}
      ${(!brandStats.unused.length && !keywordStats.unused.length && !locationStats.unused.length && brandStats.total <= 8)
        ? "<li>No critical issues found ✓</li>" : ""}
    </ul>
  `;

  document.getElementById("report").innerHTML = report;
}

function downloadWord() {
  const content = document.getElementById("output").innerHTML;

  if (!content) {
    alert("Please highlight content first.");
    return;
  }

  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          .brand { background:#c92d9a; color:#fff; }
          .keyword { background:#ebe538; }
          .location { background:#15f5f7; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "highlighted-content.doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
