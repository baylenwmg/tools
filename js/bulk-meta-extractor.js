const BACKEND_URL = "https://bulk-meta-extractor-backend.onrender.com/extract";
const BATCH_SIZE = 4;

window.extract = async function () {
    const statusEl = document.getElementById("status");
    const urls = document.getElementById("urls").value
        .split("\n")
        .map(u => u.trim())
        .filter(Boolean);

    if (!urls.length) {
        statusEl.textContent = "Please add URLs first.";
        return;
    }

    const total = urls.length;
    let completed = 0;
    const results = [];

    statusEl.textContent = `Processing 0 / ${total} URLs…`;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);

        try {
            const res = await fetch(BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: batch })
            });

            const data = await res.json();
            results.push(...data);

            completed += batch.length;
            statusEl.textContent = `Processing ${completed} / ${total} URLs…`;

        } catch {
            completed += batch.length;
            statusEl.textContent = `Processing ${completed} / ${total} URLs… (partial)`;
        }
    }

    downloadCSV(results);
    statusEl.textContent = `Completed ${results.length} / ${total} URLs ✔ Downloaded`;
};

function downloadCSV(data) {
    const headers = ["URL", "Title", "Description", "H1", "H2", "Status"];

    const csv = [headers, ...data.map(r => [
        r.url, r.title, r.description, r.h1, r.h2, r.status
    ])].map(row =>
        row.map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bulk-meta-extraction.csv";
    a.click();
}
