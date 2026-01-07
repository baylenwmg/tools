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
            .split(/\n+/)
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
                text: m[0]
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
    const contentEl = document.getElementById("content");

    // 1. Validation
    if (!brandInput || !keywordInput || !contentEl.innerText.trim()) {
        alert("Please provide Brand Names, Keywords, and Content to run the audit.");
        return;
    }

    // 2. Setup Data
    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);
    let stats = { brand: 0, keyword: 0, location: 0 };

    // 3. Reset Canvas
    clearExistingHighlights(contentEl);

    // 4. Process Text Nodes
    const textNodes = [];
    walkTextNodes(contentEl, n => textNodes.push(n));

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
                
                // Update specific counts based on final "winner" matches only
                if (match.type === 'hl-brand') stats.brand++;
                else if (match.type === 'hl-keyword') stats.keyword++;
                else if (match.type === 'hl-location') stats.location++;
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
    
    auditHasRun = true;
}

/***********************
 * EXPORT WORD
 ***********************/
function downloadWord() {
    if (!auditHasRun) {
        alert("Please run the 'Run Highlight' audit before exporting.");
        return;
    }

    const content = document.getElementById("content").innerHTML;

    // Strict formatting for Microsoft Word (Arial + Specific Sizes)
    const styles = `
        <style>
            body { font-family: "Arial", sans-serif; font-size: 12pt; color: #333333; line-height: 1.5; }
            h1 { font-size: 18pt; font-weight: bold; margin-bottom: 12pt; color: #000000; }
            h2 { font-size: 16pt; font-weight: bold; margin-top: 14pt; margin-bottom: 10pt; color: #000000; }
            h3 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; color: #000000; }
            p { margin-bottom: 10pt; }
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
