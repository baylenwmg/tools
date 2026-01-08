const BACKEND_URL = "https://bulk-meta-extractor-backend.onrender.com/extract";
const BATCH_SIZE = 4;

window.extract = async function () {
    const statusEl = document.getElementById("status");
    const textarea = document.getElementById("urls");

    if (!textarea || !statusEl) {
        alert("UI elements missing");
        return;
    }

    const urls = textarea.value
        .split("\n")
        .map(u => u.trim())
        .filter(Boolean);

    if (urls.length === 0) {
        statusEl.textContent = "Please add at least one URL.";
        return;
    }

    const total = urls.length;
    let completed = 0;
    const allResults = [];

    statusEl.textContent = `Processing 0 / ${total} URLs…`;

    try {
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = urls.slice(i, i + BATCH_SIZE);

            const response = await fetch(BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: batch })
            });

            if (!response.ok) {
                throw new Error("Backend error");
            }

            const batchResults = await response.json();
            allResults.push(...batchResults);

            completed += batch.length;
            statusEl.textContent = `Processing ${completed} / ${total} URLs…`;
        }

        if (allResults.length === 0) {
            throw new Error("No data returned");
        }

        downloadCSV(allResults);
        statusEl.textContent = `Completed ${completed} / ${total} URLs ✔ File downloaded`;

    } catch (err) {
        console.error(err);
        statusEl.textContent = "Error occurred. Please try again.";
    }
};

function downloadCSV(data) {
    const headers = [
        "URL",
        "Meta Title",
        "Meta Description",
        "H1",
        "H2",
        "Status"
    ];

    const rows = data.map(item => [
        item.url || "",
        item.title || "",
        item.description || "",
        item.h1 || "",
        item.h2 || "",
        item.status || ""
    ]);

    const csvContent = [headers, ...rows]
        .map(row =>
            row.map(val =>
                `"${String(val).replace(/"/g, '""')}"`
            ).join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-meta-extraction.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}
