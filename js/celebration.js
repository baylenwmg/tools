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
    root.normalize();
}

/**
 * Builds a regex for a given term based on the matching mode.
 * Fixed to better handle multi-word agency keywords.
 */
function buildRegex(term, isAgencyMode) {
    const escapedTerm = escapeRegex(term);

    if (!isAgencyMode) {
        return `\\b${escapedTerm}\\b`;
    }

    // Split into words to only pluralize the LAST word of a phrase
    const words = escapedTerm.split(/ +/);
    if (words.length === 0) return "";

    const lastWord = words.pop();
    const prefix = words.join(' ');

    let lastWordRegex;
    // Rule 1: Handle "y" -> "ies" (Policy -> Policies)
    if (lastWord.toLowerCase().endsWith('y')) {
        const root = lastWord.slice(0, -1);
        lastWordRegex = `${root}(?:y|ies)`;
    } 
    // Rule 2: Handle standard plurals and possessives (Car -> Cars, Car's)
    else {
        lastWordRegex = `${lastWord}(?:s|es|'s)?`;
    }

    // Reconstruct phrase: "NDIS" + " " + "Polic(?:y|ies)"
    const finalPattern = prefix ? `${prefix} ${lastWordRegex}` : lastWordRegex;
    return `\\b${finalPattern}\\b`;
}

/**
 * Core Scanner: Finds all potential matches in a string using dynamic Regex.
 */
function findMatches(text, list, type, matchesArray, isAgencyMode) {
    list.forEach(term => {
        const regexPattern = buildRegex(term, isAgencyMode);
        if (!regexPattern) return;
        
        const regex = new RegExp(regexPattern, "gi");
        let m;
        while ((m = regex.exec(text)) !== null) {
            matchesArray.push({
                start: m.index,
                length: m[0].length,
                type: type,
                text: m[0],
                term: term 
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

    if (!brandInput || !keywordInput || !content.trim()) {
        alert("Please provide Brand Names, Keywords, and Content to run the audit.");
        return;
    }

    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);
    
    let stats = { brand: 0, keyword: 0, location: 0 };
    const usedBrands = new Set();
    const usedKeywords = new Set();
    const usedLocations = new Set();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    clearExistingHighlights(tempDiv);
    document.getElementById("unused-keywords-card").style.display = 'none';

    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let allMatches = [];

        findMatches(text, brands, 'hl-brand', allMatches, isAgencyMode);
        findMatches(text, keywords, 'hl-keyword', allMatches, isAgencyMode);
        findMatches(text, locations, 'hl-location', allMatches, isAgencyMode);

        const typePriority = { 'hl-brand': 1, 'hl-keyword': 2, 'hl-location': 3 };

        allMatches.sort((a, b) => {
            return (a.start - b.start) ||
                   (b.length - a.length) ||
                   (typePriority[a.type] - typePriority[b.type]);
        });

        const winners = [];
        let lastIndex = 0;

        allMatches.forEach(match => {
            if (match.start >= lastIndex) {
                winners.push(match);
                lastIndex = match.start + match.length;

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

    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    const unusedB = brands.filter(b => !usedBrands.has(b));
    const unusedK = keywords.filter(k => !usedKeywords.has(k));
    const unusedL = locations.filter(l => !usedLocations.has(l));

    displayUnusedKeywords(unusedB, unusedK, unusedL);

    // Update SunEditor
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
            .hl-brand { background-color: #c92d9a; color: #ffffff; }
            .hl-keyword { background-color: #ebe538; color: #000000; }
            .hl-location { background-color: #15f5f7; color: #000000; }
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
