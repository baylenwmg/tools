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

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkTextNodes(node, cb) {
    if (node.nodeType === Node.TEXT_NODE) {
        cb(node);
    } else {
        // Convert to array to avoid issues if the DOM changes during iteration
        Array.from(node.childNodes).forEach(n => walkTextNodes(n, cb));
    }
}

/**
 * Clears existing highlight spans without losing text content
 */
function clearExistingHighlights(root) {
    const spans = root.querySelectorAll(".hl-brand, .hl-keyword, .hl-location");
    spans.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
    });
    // Normalize to merge adjacent text nodes
    root.normalize();
}

/**
 * Core Scanner: Finds all potential matches in a string
 */
function findMatches(text, list, type, matchesArray) {
    list.forEach(term => {
        // \b ensures "Whole Word" only matching
        const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
        let m;
        while ((m = regex.exec(text)) !== null) {
            matchesArray.push({
                start: m.index,
                length: m[0].length,
                type: type,
                text: m[0],
                term: term // Track the original term for unused keyword analysis
            });
        }
    });
}

/***********************
 * MAIN ACTION
 ***********************/
function highlightText() {
    const brandInput = document.getElementById("brand").value.trim();
    const keywordInput = document.getElementById("keywords").value.trim();
    const locationInput = document.getElementById("locations").value.trim();
    const content = getEditorContent();


    // 1. Validation
    if (!brandInput || !keywordInput || !content.trim()) {
        alert("Please provide Brand Names, Keywords, and Content to run the audit.");
        return;
    }

    // 2. Setup Data
    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);
    let stats = { brand: 0, keyword: 0, location: 0 };
    const usedBrands = new Set();
    const usedKeywords = new Set();
    const usedLocations = new Set();

    // 3. Create a temporary div to process the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;


    // 4. Reset Canvas
    clearExistingHighlights(tempDiv);
    document.getElementById("unused-keywords-card").style.display = 'none';

    // 5. Process Text Nodes
    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let allMatches = [];

        // Collect all possible matches across all categories
        findMatches(text, brands, 'hl-brand', allMatches);
        findMatches(text, keywords, 'hl-keyword', allMatches);
        findMatches(text, locations, 'hl-location', allMatches);

        /**
         * PRIORITY SORTING:
         * 1. Sort by Start Position (Ascending)
         * 2. Sort by Length (Descending) - Longer phrases win
         * 3. Sort by Type (Brand > Keyword > Location)
         */
        const typePriority = { 'hl-brand': 1, 'hl-keyword': 2, 'hl-location': 3 };

        allMatches.sort((a, b) => {
            return (a.start - b.start) ||
                   (b.length - a.length) ||
                   (typePriority[a.type] - typePriority[b.type]);
        });


        // 5. Filter Overlaps (Single Source of Truth)
        const winners = [];
        let lastIndex = 0;

        allMatches.forEach(match => {
            // Only accept match if it doesn't overlap with the previous winner
            if (match.start >= lastIndex) {
                winners.push(match);
                lastIndex = match.start + match.length;

                // Update specific counts and track used terms
                if (match.type === 'hl-brand') {
                    stats.brand++;
                    usedBrands.add(match.term);
                } else if (match.type === 'hl-keyword') {
                    stats.keyword++;
                    usedKeywords.add(match.term);
                } else if (match.type === 'hl-location') {
                    stats.location++;
                    usedLocations.add(match.term);
                }
            }
        });

        // 6. DOM Reconstruction for this node
        if (winners.length > 0) {
            const frag = document.createDocumentFragment();
            let cursor = 0;

            winners.forEach(m => {
                // Add text before the match
                frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));

                // Add the highlighted span
                const span = document.createElement("span");
                span.className = m.type;
                span.textContent = text.slice(m.start, m.start + m.length);
                frag.appendChild(span);

                cursor = m.start + m.length;
            });

            // Add remaining text
            frag.appendChild(document.createTextNode(text.slice(cursor)));
            node.parentNode.replaceChild(frag, node);
        }
    });

    // 7. Update Dashboard Stats
    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    // 8. Find and Display Unused Keywords
    const unusedBrands = brands.filter(b => !usedBrands.has(b));
    const unusedKeywords = keywords.filter(k => !usedKeywords.has(k));
    const unusedLocations = locations.filter(l => !usedLocations.has(l));

    displayUnusedKeywords(unusedBrands, unusedKeywords, unusedLocations);

    editor.setContents('');
    editor.insertHTML(tempDiv.innerHTML, true);

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
 * UTILITY ACTIONS
 ***********************/


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
            .hl-brand { background-color: #c92d9a; color: #ffffff; padding: 2pt; }
            .hl-keyword { background-color: #ebe538; color: #000000; padding: 2pt; }
            .hl-location { background-color: #15f5f7; color: #000000; padding: 2pt; }
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
