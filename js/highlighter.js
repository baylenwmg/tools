function parseList(input) {
  return [...new Set(
    input.split(/,|\n|\t/)
      .map(v => v.trim())
      .filter(Boolean)
  )];
}

function buildRegex(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "gi");
}

function getWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* 🔥 DOM-SAFE HIGHLIGHTING */
function highlightText() {
  document.getElementById("report").innerHTML = "";
  document.getElementById("output").innerHTML = "";

  const brands = parseList(document.getElementById("brand").value);
  const keywords = parseList(document.getElementById("keywords").value);
  const locations = parseList(document.getElementById("locations").value);

  const editor = document.getElementById("content");
  const clone = editor.cloneNode(true);

  const textOnly = editor.innerText;
  const wordCount = getWordCount(textOnly);

  const stats = {
    brand: processGroup(clone, brands, "brand"),
    keyword: processGroup(clone, keywords, "keyword"),
    location: processGroup(clone, locations, "location")
  };

  document.getElementById("output").innerHTML = clone.innerHTML;

  renderReport(wordCount, stats);
}

function processGroup(root, list, className) {
  let total = 0;
  const used = [];
  const unused = [];

  list.forEach(term => {
    const regex = buildRegex(term);
    let found = false;

    walkTextNodes(root, node => {
      if (regex.test(node.nodeValue)) {
        found = true;
        const span = document.createElement("span");
        span.className = className;
        span.textContent = node.nodeValue;

        node.parentNode.replaceChild(span, node);
        total++;
      }
    });

    found ? used.push(term) : unused.push(term);
  });

  return { total, used, unused };
}

function walkTextNodes(node, callback) {
  if (node.nodeType === Node.TEXT_NODE) {
    callback(node);
  } else {
    node.childNodes.forEach(child => walkTextNodes(child, callback));
  }
}

function renderReport(wordCount, stats) {
  const report = `
    <h3>Summary</h3>
    <ul>
      <li><b>Word Count:</b> ${wordCount}</li>
      <li><b>Brand Usage:</b> ${stats.brand.total} ${stats.brand.total > 8 ? "⚠ Overused" : "✓ OK"}</li>
      <li><b>Keywords Used:</b> ${stats.keyword.used.length} / ${stats.keyword.used.length + stats.keyword.unused.length}</li>
      <li><b>Locations Used:</b> ${stats.location.used.length} / ${stats.location.used.length + stats.location.unused.length}</li>
    </ul>

    <h3>Issues</h3>
    <ul>
      ${stats.brand.unused.length ? `<li>Unused Brands: ${stats.brand.unused.join(", ")}</li>` : ""}
      ${stats.keyword.unused.length ? `<li>Unused Keywords: ${stats.keyword.unused.join(", ")}</li>` : ""}
      ${stats.location.unused.length ? `<li>Missing Locations: ${stats.location.unused.join(", ")}</li>` : ""}
      ${stats.brand.total > 8 ? `<li>Brand may be overused</li>` : ""}
      ${(!stats.brand.unused.length && !stats.keyword.unused.length && !stats.location.unused.length && stats.brand.total <= 8)
        ? "<li>No critical issues found ✓</li>" : ""}
    </ul>
  `;

  document.getElementById("report").innerHTML = report;
}

function downloadWord() {
  const content = document.getElementById("output").innerHTML;

  if (!content) {
    alert("Please run the highlighter first.");
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
