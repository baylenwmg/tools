async function extract() {
    const statusEl = document.getElementById("status");

    const urls = document.getElementById("urls").value
        .split("\n")
        .map(u => u.trim())
        .filter(Boolean);

    if (!urls.length) {
        statusEl.textContent = "Please add at least one URL.";
        return;
    }

    const total = urls.length;
    statusEl.textContent = `Processing 0 / ${total} URLs…`;

    try {
        const response = await fetch(
            "https://bulk-meta-extractor-backend.onrender.com/extract",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls })
            }
        );

        if (!response.ok) {
            throw new Error("Backend error");
        }

        const data = await response.json();

        // 🔹 Update progress visually (final state)
        statusEl.textContent = `Processing ${total} / ${total} URLs… preparing export`;

        const rows = data.map(item => ([
            item.url,
            item.title || "",
            item.description || "",
            item.h1 || "",
            item.h2 || "",
            item.status || ""
        ]));

        downloadCSV(rows);

        statusEl.textContent = `Completed ${total} / ${total} URLs ✔ Excel downloaded`;

    } catch (error) {
        statusEl.textContent =
            "Something went wrong. Please try again in a moment.";
    }
}
