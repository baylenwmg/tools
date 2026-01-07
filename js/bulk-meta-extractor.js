async function runExtraction() {
  const raw = document.getElementById("urls").value.trim();
  if (!raw) {
    alert("Please paste URLs");
    return;
  }

  const urls = raw.split("\n").map(u => u.trim()).filter(Boolean);

  const res = await fetch("http://localhost:3000/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls })
  });

  const data = await res.json();

  let csv = "URL,Meta Title,Meta Description,H1,H2,Status\n";

  data.forEach(row => {
    csv += `"${row.URL}","${safe(row["Meta Title"])}","${safe(row["Meta Description"])}","${safe(row.H1)}","${safe(row.H2)}","${row.Status}"\n`;
  });

  download(csv);
}

function safe(text = "") {
  return text.replace(/"/g, '""');
}

function download(csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bulk-meta-extractor.csv";
  a.click();
}
