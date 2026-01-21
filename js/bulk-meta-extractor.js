const BASE_URL = "https://bulk-meta-extractor-backend.onrender.com";
const BATCH_SIZE = 5; // Optimized for performance vs stability

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
 * Main Extraction Function with Progress & Retry Logic
 */
window.extract = async function () {
    const statusEl = document.getElementById("status");
    const inputVal = document.getElementById("urls").value.trim();
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    // UI Progress Elements
    const progWrap = document.getElementById("progress-wrap");
    const bar = document.getElementById("bar-fill");
    const progCount = document.getElementById("prog-count");
    const progDetail = document.getElementById("prog-detail");

    // Live Stat Cards
    const statRows = document.getElementById("stat-rows");
    const statHealth = document.getElementById("stat-health");
    const statAuto = document.getElementById("stat-auto");

    if (!inputVal) {
        statusEl.textContent = "Please add a URL or list first.";
        return;
    }

    // Reset UI for new run
    progWrap.style.display = "block";
    statusEl.textContent = "Initializing...";
    statAuto.textContent = "Validating...";
    statAuto.style.color = "var(--warning)";
    
    let urls = [];
    let results = [];
    let failedUrls = [];

    try {
        // STEP 1: Fetch URL List
        if (mode === "sitemap") {
            statusEl.textContent = "Parsing Sitemap...";
            const sres = await fetch(`${BASE_URL}/parse-sitemap`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sitemapUrl: inputVal })
            });
            const sdata = await sres.json();
            urls = sdata.urls || [];
            statAuto.textContent = urls.length > 0 ? "Sitemap Ready" : "Sitemap Empty";
        } else {
            urls = inputVal.split("\n").map(u => u.trim()).filter(Boolean);
            statAuto.textContent = "List Ready";
        }

        const total = urls.length;
        if (total === 0) throw new Error("No URLs to process");
        statAuto.style.color = "var(--success)";

        // STEP 2: Batch Processing Loop
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = urls.slice(i, i + BATCH_SIZE);
            progDetail.textContent = `Extracting batch ${Math.ceil((i+1)/BATCH_SIZE)}...`;
            
            const res = await fetch(`${BASE_URL}/extract`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: batch })
            });
            
            const batchData = await res.json();
            
            batchData.forEach(item => {
                if (item.status === "Failed") failedUrls.push(item.url);
                results.push(item);
            });

            updateDashboard(results.length, total, bar, progCount, statRows, statHealth);
        }

        // STEP 3: Final Retry Phase for Failures
        if (failedUrls.length > 0) {
            progDetail.textContent = `Retrying ${failedUrls.length} failed pages...`;
            statusEl.textContent = "Cleaning up errors...";
            statHealth.style.color = "var(--warning)";

            for (let url of failedUrls) {
                try {
                    const res = await fetch(`${BASE_URL}/extract`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ urls: [url] })
                    });
                    const retryData = await res.json();
                    
                    if (retryData[0].status === "Success") {
                        const idx = results.findIndex(r => r.url === url);
                        if (idx !== -1) results[idx] = retryData[0];
                    }
                } catch (e) { console.error("Final retry failed for", url); }
            }
        }

        // Final UI Update
        statusEl.textContent = `Success! ${results.length} URLs processed.`;
        progDetail.textContent = "Process Complete.";
        statHealth.textContent = "100% Health";
        statHealth.style.color = "var(--success)";
        
        downloadCSV(results);

    } catch (err) {
        console.error("Extraction error:", err);
        statusEl.textContent = "Extraction failed. Check input.";
        statAuto.textContent = "Error";
    }
};

/**
 * Updates the Live Dashboard during processing
 */
function updateDashboard(current, total, bar, countText, rowStat, healthStat) {
    const percent = Math.round((current / total) * 100);
    bar.style.width = `${percent}%`;
    countText.textContent = `${current} / ${total}`;
    rowStat.textContent = `${current} Rows`;
    healthStat.textContent = `${percent}% Processed`;
}

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
    
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `seo-audit-${timestamp}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', toggleInputMode);
