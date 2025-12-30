function parseList(input) {
  return [...new Set(
    input
      .split(/,|\n|\t/)
      .map(v => v.trim())
      .filter(Boolean)
  )];
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function highlightAndTrack(content, list, cssClass) {
  let total = 0;
  const used = [];
  const unused = [];
  let updated = content;

  list.forEach(item => {
    const pattern = buildPattern(item);
    const regex = new RegExp(`(${pattern})`, "g");
    let found = false;

    updated = updated.replace(regex, match => {
      total++;
      found = true;
      return `<span class="${cssClass}">${match}</span>`;
    });

    if (found) used.push(item);
    else unused.push(item);
  });

  return { updated, total, used, unused };
}

function getWordCount(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function highlightText() {
  const brandInput = document.getElementById("brand").value;
  const keywordInput = document.getElementById("keywords").value;
  const locationInput = document.getElementById("locations").value;
  const rawContent = document.getElementById("content").value;

  if (!rawContent.trim()) {
    alert("Please paste content first.");
    return;
  }

  const brands = parseList(brandInput);
  const keywords = parseList(keywordInput);
  const locations = parseList(locationInput);

  let content = rawContent;

  const brandStats = highlightAndTrack(content, brands, "brand");
  content = brandStats.updated;

  const keywordStats = highlightAndTrack(content, keywords, "keyword");
  content = keywordStats.updated;

  const locationStats = highlightAndTrack(content, locations, "location");
  content = locationStats.updated;

  const wordCount = getWordCount(rawContent);

  document.getElementById("output").innerHTML = content;

  renderReport({
    wordCount,
    brandStats,
    keywordStats,
    locationStats
  });
}

function renderReport(data) {
  const summary = `
    <h3>Summary</h3>
    <ul>
      <li><b>Word Count:</b> ${data.wordCount}</li>
      <li><b>Brand Usage:</b> ${data.brandStats.total}
        ${data.brandStats.total > 8 ? "⚠ Overused" : "✔ OK"}
      </li>
      <li><b>Keywords Used:</b> ${data.keywordStats.used.length} / ${data.keywordStats.used.length + data.keywordStats.unused.length}</li>
      <li><b>Locations Used:</b> ${data.locationStats.used.length} / ${data.locationStats.used.length + data.locationStats.unused.length}</li>
    </ul>
  `;

  const issues = `
    <h3>Issues</h3>
    <ul>
      ${data.brandStats.unused.length ? `<li>Unused Brands: ${data.brandStats.unused.join(", ")}</li>` : ""}
      ${data.keywordStats.unused.length ? `<li>Unused Keywords: ${data.keywordStats.unused.join(", ")}</li>` : ""}
      ${data.locationStats.unused.length ? `<li>Missing Locations: ${data.locationStats.unused.join(", ")}</li>` : ""}
      ${data.brandStats.total > 8 ? `<li>Brand name may be overused</li>` : ""}
      ${(!data.brandStats.unused.length && !data.keywordStats.unused.length && !data.locationStats.unused.length && data.brandStats.total <= 8)
        ? "<li>No critical issues found ✔</li>" : ""}
    </ul>
  `;

  document.getElementById("output").insertAdjacentHTML("beforebegin", summary + issues);
}

function downloadWord() {
  const content = document.getElementById("output").innerHTML;
  if (!content) {
    alert("Please run the highlighter first.");
    return;
  }

  const html = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>${content}</body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "highlighted-content.doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
