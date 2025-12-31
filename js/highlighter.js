/***********************
 * GLOBAL STATE
 ***********************/
let auditHasRun = false;

/***********************
 * HELPERS
 ***********************/
function parseLines(input) {
  return [...new Set(
    input
      .split(/\n+/)
      .map(v => v.trim())
      .filter(Boolean)
  )];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkTextNodes(node, cb) {
  if (node.nodeType === Node.TEXT_NODE) {
    cb(node);
  } else {
    node.childNodes.forEach(n => walkTextNodes(n, cb));
  }
}

/***********************
 * CLEAR OLD HIGHLIGHTS
 ***********************/
function clearExistingHighlights(root) {
  const spans = root.querySelectorAll(".hl-brand, .hl-keyword, .hl-location");
  spans.forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
}

/***********************
 * BRAND PRIORITY CHECK
 ***********************/
function isInsideBrand(node) {
  let current = node.parentNode;
  while (current) {
    if (current.classList && current.classList.contains("hl-brand")) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

/***********************
 * HIGHLIGHT GROUP
 ***********************/
function highlightGroup(root, list, className) {
  let total = 0;

  list.forEach(term => {
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");

    walkTextNodes(root, textNode => {
      if (className !== "hl-brand" && isInsideBrand(textNode)) return;

      const text = textNode.nodeValue;
      if (!regex.test(text)) return;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      text.replace(regex, (match, index) => {
        total++;

        frag.appendChild(
          document.createTextNode(text.slice(lastIndex, index))
        );

        const span = document.createElement("span");
        span.className = className;
        span.textContent = match;
        frag.appendChild(span);

        lastIndex = index + match.length;
      });

      frag.appendChild(
        document.createTextNode(text.slice(lastIndex))
      );

      textNode.parentNode.replaceChild(frag, textNode);
    });
  });

  return { total };
}

/***********************
 * MAIN ACTION
 ***********************/
function highlightText() {
  const brandVal = document.getElementById("brand").value.trim();
  const keywordVal = document.getElementById("keywords").value.trim();
  const contentEl = document.getElementById("content");
  const contentText = contentEl.innerText.trim();

  // ❌ VALIDATION
  if (!brandVal || !keywordVal || !contentText) {
    alert("Please add Brand Names, Keywords, and Content before running the audit.");
    return;
  }

  auditHasRun = false;

  const clone = contentEl.cloneNode(true);
  clearExistingHighlights(clone);

  const brands = parseLines(brandVal);
  const keywords = parseLines(keywordVal);
  const locations = parseLines(
    document.getElementById("locations").value.trim()
  );

  const brandStats = highlightGroup(clone, brands, "hl-brand");
  const keywordStats = highlightGroup(clone, keywords, "hl-keyword");
  const locationStats = highlightGroup(clone, locations, "hl-location");

  // Render back
  contentEl.innerHTML = clone.innerHTML;

  // Update floating summary
  document.getElementById("count-brand").textContent = brandStats.total;
  document.getElementById("count-keyword").textContent = keywordStats.total;
  document.getElementById("count-location").textContent = locationStats.total;

  auditHasRun = true;
}

/***********************
 * EXPORT WORD
 ***********************/
function downloadWord() {
  if (!auditHasRun) {
    alert("Please run the audit before exporting the Word file.");
    return;
  }

  const content = document.getElementById("content").innerHTML.trim();

  if (!content) {
    alert("No highlighted content found to export.");
    return;
  }

  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          .hl-brand { background:#fbbf24; color:#000; }
          .hl-keyword { background:#60a5fa; color:#fff; }
          .hl-location { background:#34d399; color:#000; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], {
    type: "application/msword"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "signal-highlighted-content.doc";
  a.click();
}
