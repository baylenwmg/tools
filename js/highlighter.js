/***********************
 * GLOBAL STATE
 ***********************/
let auditHasRun = false;

/***********************
 * HELPERS
 ***********************/
function parseLines(input) {
    return [...new Set(
        input
        .split(/\n+|\\n/)
        .map(v => v.trim())
        .filter(Boolean)
    )];
}

/***********************
 * MAIN ACTION
 ***********************/
async function highlightText() {
    // 1. Get Inputs & Validate
    const brandInput = document.getElementById("brand").value.trim();
    const keywordInput = document.getElementById("keywords").value.trim();
    const locationInput = document.getElementById("locations").value.trim();
    const isAgencyMode = document.getElementById('agency-mode-toggle').checked;
    const contentEl = editor.core.context.element.wysiwyg;

    if (!brandInput || !keywordInput || !contentEl.textContent.trim()) {
        alert("Please provide Brand Names, Keywords, and Content to run the audit.");
        return;
    }

    // 2. Setup Data
    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);
    const instance = new Mark(contentEl);

    document.getElementById("unused-keywords-card").style.display = 'none';

    // 3. Unmark previous highlights
    await new Promise(resolve => instance.unmark({
        done: resolve
    }));

    // 4. Combine and sort all terms by length (desc) to prioritize longer matches
    const allTerms = [
        ...brands.map(t => ({
            term: t,
            className: 'hl-brand',
            type: 'brand'
        })),
        ...keywords.map(t => ({
            term: t,
            className: 'hl-keyword',
            type: 'keyword'
        })),
        ...locations.map(t => ({
            term: t,
            className: 'hl-location',
            type: 'location'
        }))
    ].sort((a, b) => b.term.length - a.term.length);

    let stats = {
        brand: 0,
        keyword: 0,
        location: 0
    };
    const usedOriginalTerms = new Set();

    // 5. Mark each term one by one to handle overlaps correctly
    for (const { term, className, type }
        of allTerms) {
        let matchesFound = 0;
        await new Promise(resolve => {
            instance.mark(term, {
                element: 'span',
                className: className,
                separateWordSearch: false,
                accuracy: isAgencyMode ? 'complementary' : 'exactly',
                iframes: false,
                filter: (textNode) => textNode.parentElement.nodeName !== 'SPAN',
                each: () => matchesFound++,
                done: resolve
            });
        });

        if (matchesFound > 0) {
            usedOriginalTerms.add(term);
            stats[type] += matchesFound;
        }
    }

    // 6. Update UI
    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    const unusedBrands = brands.filter(b => !usedOriginalTerms.has(b));
    const unusedKeywords = keywords.filter(k => !usedOriginalTerms.has(k));
    const unusedLocations = locations.filter(l => !usedOriginalTerms.has(l));
    displayUnusedKeywords(unusedBrands, unusedKeywords, unusedLocations);

    auditHasRun = true;
}


/***********************
 * UNUSED KEYWORDS DISPLAY
 ***********************/
function displayUnusedKeywords(brands, keywords, locations) {
    const container = document.getElementById("unused-keywords-container");
    const card = document.getElementById("unused-keywords-card");
    container.innerHTML = ''; // Clear previous results

    let html = '';

    if (brands.length > 0) {
        html += `
            <div class="unused-list">
                <h4 style="border-color: var(--brand-color);">Unused Brands</h4>
                <ul>${brands.map(k => `<li>${k}</li>`).join('')}</ul>
            </div>`;
    }
    if (keywords.length > 0) {
        html += `
            <div class="unused-list">
                <h4 style="border-color: var(--keyword-color);">Unused Keywords</h4>
                <ul>${keywords.map(k => `<li>${k}</li>`).join('')}</ul>
            </div>`;
    }
    if (locations.length > 0) {
        html += `
            <div class="unused-list">
                <h4 style="border-color: var(--location-color);">Unused Locations</h4>
                <ul>${locations.map(k => `<li>${k}</li>`).join('')}</ul>
            </div>`;
    }

    if (html) {
        container.innerHTML = html;
        card.style.display = 'block';
    } else {
        card.style.display = 'none';
    }
}

/***********************
 * EXPORT WORD
 ***********************/
function downloadWord() {
    if (!auditHasRun) {
        alert("Please run the 'Run Highlight' audit before exporting.");
        return;
    }

    const wysiwyg = editor.core.context.element.wysiwyg;
    let content = wysiwyg.innerHTML;

    // Clean the placeholder text if it exists
    const placeholder = "Paste your content here...";
    if (content.includes(placeholder)) {
        content = content.replace(placeholder, "");
    }

    // Strict formatting for Microsoft Word (Arial + Specific Sizes)
    const styles = `
        <style>
            body { font-family: "Arial", sans-serif; font-size: 12pt; color: #000000; line-height: 1.5; font-weight: normal; }
            h1 { font-size: 18pt; font-weight: bold; margin-bottom: 12pt; color: #000000; }
            h2 { font-size: 16pt; font-weight: bold; margin-top: 14pt; margin-bottom: 10pt; color: #000000; }
            h3 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; color: #000000; }
            p { margin-bottom: 10pt; font-size: 12pt; font-weight: normal; }
            .hl-brand { background-color: #d946ef; color: #ffffff; padding: 2pt; }
            .hl-keyword { background-color: #f59e0b; color: #000000; padding: 2pt; }
            .hl-location { background-color: #10b981; color: #000000; padding: 2pt; }
        </style>
    `;

    const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            ${styles}
        </head>
        <body>
            ${content}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', html], {
        type: "application/msword"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Highlighted-Content-Audit.doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}