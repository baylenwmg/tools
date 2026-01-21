/***********************
 * GLOBAL STATE
 ***********************/
let auditHasRun = false;

/***********************
 * HELPERS
 ***********************/
function parseLines(input) {
    return [...new Set(
        input.split(/\n+|\\n/).map(v => v.trim()).filter(Boolean)
    )];
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkTextNodes(node, cb) {
    if (node.nodeType === Node.TEXT_NODE) {
        cb(node);
    } else {
        Array.from(node.childNodes).forEach(n => walkTextNodes(n, cb));
    }
}

function clearExistingHighlights(root) {
    const spans = root.querySelectorAll(".hl-brand, .hl-keyword, .hl-location");
    spans.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
    });
    root.normalize();
}

/**
 * IMPROVED Agency Mode Regex
 * Ensures strict word boundaries and handles plurals/possessives
 */
function buildRegex(term, isAgencyMode) {
    const escapedTerm = escapeRegex(term);
    if (!isAgencyMode) return `\\b${escapedTerm}\\b`;

    const words = escapedTerm.split(/ +/);
    const lastWord = words.pop();
    const prefix = words.join(' ');

    let lastWordRegex;
    // Policy -> Polic(y|ies)
    if (lastWord.toLowerCase().endsWith('y')) {
        const root = lastWord.slice(0, -1);
        lastWordRegex = `${root}(?:y|ies)`;
    } else {
        // Vehicle -> Vehicle(s|es|'s)
        lastWordRegex = `${lastWord}(?:s|es|'s)?`;
    }

    // Reconstruct with word boundaries to avoid partial word matches
    return prefix ? `\\b${prefix}\\s+${lastWordRegex}\\b` : `\\b${lastWordRegex}\\b`;
}

function findMatches(text, list, type, matchesArray, isAgencyMode) {
    list.forEach(term => {
        const regexPattern = buildRegex(term, isAgencyMode);
        const regex = new RegExp(regexPattern, "gi");
        let m;
        while ((m = regex.exec(text)) !== null) {
            matchesArray.push({
                start: m.index,
                length: m[0].length,
                type: type,
                text: m[0],
                term: term // Original keyword from your input list
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
    const isAgencyMode = document.getElementById('agency-mode-toggle').checked;

    if (!brandInput && !keywordInput && !locationInput) {
        alert("Please provide input data.");
        return;
    }

    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);
    
    let stats = { brand: 0, keyword: 0, location: 0 };
    
    // Using a Set for Case-Insensitive tracking
    const usedTermsNormalized = new Set(); 

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    clearExistingHighlights(tempDiv);

    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let allMatches = [];

        findMatches(text, brands, 'hl-brand', allMatches, isAgencyMode);
        findMatches(text, keywords, 'hl-keyword', allMatches, isAgencyMode);
        findMatches(text, locations, 'hl-location', allMatches, isAgencyMode);

        // Sort by position, then by length (longest match wins)
        allMatches.sort((a, b) => (a.start - b.start) || (b.length - a.length));

        const winners = [];
        let lastIndex = 0;

        allMatches.forEach(match => {
            if (match.start >= lastIndex) {
                winners.push(match);
                lastIndex = match.start + match.length;
                
                // Track original keyword as used (Normalized for safety)
                usedTermsNormalized.add(match.term.toLowerCase()); 

                if (match.type === 'hl-brand') stats.brand++;
                if (match.type === 'hl-keyword') stats.keyword++;
                if (match.type === 'hl-location') stats.location++;
            }
        });

        if (winners.length > 0) {
            const frag = document.createDocumentFragment();
            let cursor = 0;
            winners.forEach(m => {
                frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
                const span = document.createElement("span");
                span.className = m.type;
                span.textContent = text.slice(m.start, m.start + m.length);
                frag.appendChild(span);
                cursor = m.start + m.length;
            });
            frag.appendChild(document.createTextNode(text.slice(cursor)));
            node.parentNode.replaceChild(frag, node);
        }
    });

    // Update Stats
    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    // Filter Unused List (Normalized check)
    displayUnusedKeywords(
        brands.filter(b => !usedTermsNormalized.has(b.toLowerCase())),
        keywords.filter(k => !usedTermsNormalized.has(k.toLowerCase())),
        locations.filter(l => !usedTermsNormalized.has(l.toLowerCase()))
    );

    // Sync to Editor
    editor.setContents(tempDiv.innerHTML);
    auditHasRun = true;
}

/***********************
 * UNUSED KEYWORDS DISPLAY
 ***********************/
function displayUnusedKeywords(brands, keywords, locations) {
    const container = document.getElementById("unused-keywords-container");
    const card = document.getElementById("unused-keywords-card");
    container.innerHTML = '';

    let html = '';
    if (brands.length > 0) {
        html += `<div class="unused-list"><h4 style="border-color: var(--brand-color);">Unused Brands</h4><ul>${brands.map(k => `<li>${k}</li>`).join('')}</ul></div>`;
    }
    if (keywords.length > 0) {
        html += `<div class="unused-list"><h4 style="border-color: var(--keyword-color);">Unused Keywords</h4><ul>${keywords.map(k => `<li>${k}</li>`).join('')}</ul></div>`;
    }
    if (locations.length > 0) {
        html += `<div class="unused-list"><h4 style="border-color: var(--location-color);">Unused Locations</h4><ul>${locations.map(k => `<li>${k}</li>`).join('')}</ul></div>`;
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

    const content = editor.getContents();
    const styles = `
        <style>
            body { font-family: "Arial", sans-serif; font-size: 12pt; color: #000000; line-height: 1.5; }
            .hl-brand { background-color: #c92d9a; color: #ffffff; padding: 1px 3px; }
            .hl-keyword { background-color: #ebe538; color: #000000; padding: 1px 3px; }
            .hl-location { background-color: #15f5f7; color: #000000; padding: 1px 3px; }
        </style>
    `;

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset="utf-8">${styles}</head>
        <body>${content}</body></html>`;

    const blob = new Blob(['\ufeff', html], { type: "application/msword" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Highlighted-Content-Audit.doc";
    link.click();
}
