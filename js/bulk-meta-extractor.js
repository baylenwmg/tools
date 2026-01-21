const BACKEND_URL = "https://bulk-meta-extractor-backend.onrender.com/extract";
const BATCH_SIZE = 4;

/**
 * UI Toggle: Adjusts the textarea based on mode
 */
window.toggleInputMode = function() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const label = document.getElementById("input-label");
    const textarea = document.getElementById("urls");

    if (mode === "sitemap") {
        label.textContent = "Sitemap XML URL";
        textarea.placeholder = "https://example.com/sitemap_index.xml";
        textarea.style.minHeight = "60px";
    } else {
        label.textContent = "Source URLs";
        textarea.placeholder = "https://example.com/page-1\nhttps://example.com/page-2";
        textarea.style.minHeight = "220px";
    }
};

/**
 * Main Extraction Function
 */
window.extract = async function () {
    const statusEl = document.getElementById("status");
    const inputVal = document.getElementById("urls").value.trim();
    const mode = document.querySelector('input[name="mode"]:checked').value;

    if (!inputVal) {
        statusEl.textContent = "Please add a URL or list first.";
        return;
    }

    statusEl.textContent = "Starting process...";

    // Prepare Payload
    let payload = {};
    if (mode === "sitemap") {
        payload = { sitemapUrl: inputVal, urls: [] };
    } else {
        const urls = inputVal.split("\n").map(u => u.trim()).filter(Boolean);
        payload = { urls: urls };
    }

    try {
        statusEl.textContent = mode === "sitemap" ? "Fetching sitemap & extracting..." : "Processing batch...";

        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Server error");

        const results = await response.json();

        if (results && results.length > 0) {
            downloadCSV(results);
            statusEl.textContent = `Success! ${results.length} URLs processed. ✔`;
        } else {
            statusEl.textContent = "No data found. Check your URLs.";
        }

    } catch (err) {
        console.error("Extraction error:", err);
        statusEl.textContent = "Extraction failed. Check backend.";
    }
};

/**
 * CSV Generation & Download
 */
function downloadCSV(data) {
    const headers = ["URL", "Title", "Description", "H1", "H2", "Status"];

    const csvContent = [
        headers,
        ...data.map(r => [
            r.url, 
            r.title, 
            r.description, 
            r.h1, 
            r.h2, 
            r.status
        ])
    ].map(row =>
        row.map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Add timestamp to filename
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `meta-audit-${timestamp}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Ensure UI matches default selection on load
document.addEventListener('DOMContentLoaded', toggleInputMode);
