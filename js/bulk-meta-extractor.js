async function extract() {
    const statusEl = document.getElementById("status");
    statusEl.textContent = "Processing URLs… please wait";

    const urls = document.getElementById("urls").value
        .split("\n")
        .map(u => u.trim())
        .filter(Boolean);

    if (!urls.length) {
        statusEl.textContent = "Please add at least one URL.";
        return;
    }

    try {
        const response = await fetch(
            "https://bulk-meta-extractor-backend.onrender.com/extract",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ urls })
            }
        );

        if (!response.ok) {
            throw new Error("Backend error");
        }

        const data = await response.json();

        const rows = data.map(item => ([
            item.url,
            item.title || "",
            item.description || "",
            item.h1 || "",
            item.h2 || "",
            item.status || ""
        ]));

        downloadCSV(rows);
        statusEl.textContent = "Done. Excel file downloaded.";

    } catch (error) {
        statusEl.textContent =
            "Something went wrong. Please try again in a moment.";
    }
}

function downloadCSV(rows) {
    let csv = "URL,Meta Title,Meta Description,H1,H2,Status\n";

    rows.forEach(row => {
        csv += row
            .map(value =>
                `"${(value || "").replace(/"/g, '""')}"`
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
