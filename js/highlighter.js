function parseLines(input) {
  return [...new Set(
    input.split(/\n+/)
      .map(v => v.trim())
      .filter(Boolean)
  )];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function highlightText() {
  const editor = document.getElementById("content");
  const clone = editor.cloneNode(true);

  const brands = parseLines(document.getElementById("brand").value);
  const keywords = parseLines(document.getElementById("keywords").value);
  const locations = parseLines(document.getElementById("locations").value);

  const wordCount = getWordCount(editor.innerText);

  const stats = {
    brand: highlightGroup(clone, brands, "brand"),
    keyword: highlightGroup(clone, keywords, "keyword"),
    location: highlightGroup(clone, locations, "location")
  };

  document.getElementById("output").innerHTML = clone.innerHTML;
  renderSummary(wordCount, stats);
}

function highlightGroup(root, list, className) {
  let total = 0;
  const used = [];
  const unused = [];

  list.forEach(term => {
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    let found = false;

    walkTextNodes(root, node => {
      const text = node.nodeValue;
      if (!regex.test(text)) return;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      text.replace(regex, (match, index) => {
        found = true;
        total++;
        frag.appendChild(document.createTextNode(text.slice(lastIndex, index)));

        const span = document.createElement("span");
        span.className = className;
        span.textContent = match;
        frag.appendChild(span);

        lastIndex = index + match.length;
      });

      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      node.parentNode.replaceChild(frag, node);
    });

    found ? used.push(term) : unused.push(term);
  });

  return { total, used, unused };
}

function walkTextNodes(node, cb) {
  if (node.nodeType === Node.TEXT_NODE) cb(node);
  else node.childNodes.forEach(n => walkTextNodes(n, cb));
}

function renderSummary(wordCount, stats) {
  const report = `
    <div class="summary-card">
      <h3>Content Signal Assessment</h3>
      <ul>
        <li><b>Word Count:</b> ${wordCount}</li>
        <li><b>Brand Visibility:</b> ${stats.brand.total ? "Balanced" : "Missing"}</li>
        <li><b>Keyword Coverage:</b> ${stats.keyword.used.length === stats.keyword.used.length + stats.keyword.unused.length ? "Complete" : "Partial"}</li>
        <li><b>Location Signals:</b> ${stats.location.used.length ? "Present" : "Missing"}</li>
      </ul>

      <h4>Action Notes</h4>
      <ul>
        ${stats.brand.unused.length ? `<li>Unused brands: ${stats.brand.unused.join(", ")}</li>` : ""}
        ${stats.keyword.unused.length ? `<li>Unused keywords: ${stats.keyword.unused.join(", ")}</li>` : ""}
        ${stats.location.unused.length ? `<li>Missing locations: ${stats.location.unused.join(", ")}</li>` : ""}
        ${(!stats.brand.unused.length && !stats.keyword.unused.length && !stats.location.unused.length)
          ? "<li>No corrective actions required</li>" : ""}
      </ul>
    </div>
  `;

  document.getElementById("report").innerHTML = report;
}

function downloadWord() {
  const content = document.getElementById("output").innerHTML;
  if (!content) return alert("Run the audit first.");

  const html = `
    <html><head><meta charset="utf-8">
    <style>
      .brand{background:#c92d9a;color:#fff}
      .keyword{background:#ebe538}
      .location{background:#15f5f7}
    </style>
    </head><body>${content}</body></html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "highlighted-content.doc";
  a.click();
}
