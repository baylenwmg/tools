async function extract() {
    const statusEl = document.getElementById("status");
    statusEl.textContent = "Processing URLs… please wait";

    const raw = document.getElementById("urls").value
        .split("\n")
        .map(u => u.trim())
        .filter(Boolean);

    if (!raw.length) {
        statusEl.textContent = "Please add at least one URL.";
        return;
    }

    const results = [];

    for (let i = 0; i < raw.length; i++) {
        const url = raw[i];
        statusEl.textContent = `Processing ${i + 1} of ${raw.length}`;

        try {
            const response = await fetch(
                "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
                { cache: "no-store" }
            );

            if (!response.ok) throw new Error("Fetch failed");

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, "text/html");

            const title =
                doc.querySelector("title")?.innerText.trim() || "";

            const description =
                doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "";

            const h1 = Array.from(doc.querySelectorAll("h1"))
                .map(h => h.innerText.trim())
                .filter(Boolean)
                .join("\n");

            const h2 = Array.from(doc.querySelectorAll("h2"))
                .map(h => h.innerText.trim())
                .filter(Boolean)
                .join("\n");

            results.push([
                url,
                title,
                description,
                h1,
                h2,
                "Success"
            ]);

        } catch (err) {
            results.push([
                url,
                "",
                "",
                "",
                "",
                "Failed"
            ]);
        }
    }

    downloadCSV(results);
    statusEl.textContent = "Done. Excel file downloaded.";
}

function downloadCSV(rows) {
    let csv =
        "URL,Meta Title,Meta Description,H1,H2,Status\n";

    rows.forEach(row => {
        csv += row
            .map(val =>
                `"${(val || "").replace(/"/g, '""')}"`
            )
            .join(",") + "\n";
    });

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bulk-meta-extractor.csv";
    link.click();
}
