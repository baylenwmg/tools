function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightGroup(text, words, className) {
  words.forEach(word => {
    if (!word) return;
    const regex = new RegExp(`(${escapeRegExp(word)})`, 'gi');
    text = text.replace(regex, `<span class="${className}">$1</span>`);
  });
  return text;
}

function highlightText() {
  let content = document.getElementById("content").value;

  const brand = document.getElementById("brand").value.trim();
  const keywords = document.getElementById("keywords").value.split(",");
  const locations = document.getElementById("locations").value.split(",");

  if (brand) {
    content = highlightGroup(content, [brand], "brand");
  }

  content = highlightGroup(content, keywords, "keyword");
  content = highlightGroup(content, locations, "location");

  document.getElementById("output").innerHTML = content;
}

function downloadWord() {
  const content = document.getElementById("output").innerHTML;
  if (!content) {
    alert("Please highlight content first.");
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
