const BACKEND_URL = "http://localhost:3000/extract"; 
// ⬆️ CHANGE THIS when backend is deployed

document.getElementById("extractBtn").addEventListener("click", runExtraction);

async function runExtraction() {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "";

  const raw = document.getElementById("urls").value.trim();
  if (!raw) {
    statusEl.textContent = "Please paste URLs first.";
    return;
  }

  const urls = raw.split("\n").map(u => u.trim()).filter(Boolean);

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls })
    });

    if (!res.ok) {
      throw new Error("Backend not reachable");
    }

    const data = await res.json();
    generateCSV(data);

  } catch (err) {
    statusEl.textContent =
      "Backend is not connected. Start server.js or update BACKEND_URL.";
  }
}

function generateCSV(data) {
  let csv = "URL,Meta Title,Meta Description,H1,H2,Status\n";

  data.forEach(row => {
    csv += `"${safe(row.URL)}","${safe(row["Meta Title"])}","${safe(row["Meta Description"])}","${safe(row.H1)}","${safe(row.H2)}","${row.Status}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bulk-meta-extractor.csv";
  a.click();
}

function safe(text = "") {
  return text.replace(/"/g, '""');
}
