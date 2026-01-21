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

/**
 * Build singular/plural safe regex
 * Works for:
 * wall ⇄ walls
 * service ⇄ services
 * policy ⇄ policies
 * AND multi-word phrases
 */
function buildPluralRegex(term) {
    const words = term.split(/\s+/).map(word => {
        if (word.endsWith('y')) {
            const root = word.slice(0, -1);
            return `${escapeRegex(root)}(y|ies)`;
        }
        return `${escapeRegex(word)}(s|es)?`;
    });

    return `\\b${words.join('\\s+')}\\b`;
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
        span.replaceWith(document.createTextNode(span.textContent));
    });
    root.normalize();
}

/***********************
 * CORE MATCHING
 ***********************/
function findMatches(text, list, type, matchesArray, variantTracker) {
    list.forEach(term => {
        const regex = new RegExp(buildPluralRegex(term), "gi");
        let m;

        while ((m = regex.exec(text)) !== null) {
            const matchedText = m[0];

            // Track plural/singular variant usage
            if (matchedText.toLowerCase() !== term.toLowerCase()) {
                if (!variantTracker.has(term)) {
                    variantTracker.set(term, new Set());
                }
                variantTracker.get(term).add(matchedText);
            }

            matchesArray.push({
                start: m.index,
                length: matchedText.length,
                type,
                text: matchedText,
                term
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

    const variantMatches = new Map(); // ⭐ NEW

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    clearExistingHighlights(tempDiv);
    document.getElementById("unused-keywords-card").style.display = 'none';
    document.getElementById("variant-match-card").style.display = 'none';

    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let allMatches = [];

        findMatches(text, brands, 'hl-brand', allMatches, variantMatches);
        findMatches(text, keywords, 'hl-keyword', allMatches, variantMatches);
        findMatches(text, locations, 'hl-location', allMatches, variantMatches);

        const typePriority = { 'hl-brand': 1, 'hl-keyword': 2, 'hl-location': 3 };

        allMatches.sort((a, b) =>
            (a.start - b.start) ||
            (b.length - a.length) ||
            (typePriority[a.type] - typePriority[b.type])
        );

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

        if (winners.length) {
            const frag = document.createDocumentFragment();
            let cursor = 0;

            winners.forEach(m => {
                frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));

                const span = document.createElement("span");
                span.className = m.type;
                span.textContent = m.text;
                frag.appendChild(span);

                cursor = m.start + m.length;
            });

            frag.appendChild(document.createTextNode(text.slice(cursor)));
            node.replaceWith(frag);
        }
    });

    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    const unusedBrands = brands.filter(b => !usedBrands.has(b));
    const unusedKeywords = keywords.filter(k => !usedKeywords.has(k));
    const unusedLocations = locations.filter(l => !usedLocations.has(l));

    displayUnusedKeywords(unusedBrands, unusedKeywords, unusedLocations);
    displayVariantMatches(variantMatches);

    editor.setContents('');
    editor.insertHTML(tempDiv.innerHTML, true);

    auditHasRun = true;
}

/***********************
 * UNUSED + VARIANT UI
 ***********************/
function displayUnusedKeywords(brands, keywords, locations) {
    const container = document.getElementById("unused-keywords-container");
    const card = document.getElementById("unused-keywords-card");
    container.innerHTML = '';

    let html = '';

    if (brands.length)
        html += `<div class="unused-list"><h4>Unused Brands</h4><ul>${brands.map(v => `<li>${v}</li>`).join('')}</ul></div>`;
    if (keywords.length)
        html += `<div class="unused-list"><h4>Unused Keywords</h4><ul>${keywords.map(v => `<li>${v}</li>`).join('')}</ul></div>`;
    if (locations.length)
        html += `<div class="unused-list"><h4>Unused Locations</h4><ul>${locations.map(v => `<li>${v}</li>`).join('')}</ul></div>`;

    if (html) {
        container.innerHTML = html;
        card.style.display = 'block';
    }
}

function displayVariantMatches(map) {
    const card = document.getElementById("variant-match-card");
    const container = document.getElementById("variant-match-container");

    if (!map.size) return;

    let html = `<ul class="variant-list">`;
    map.forEach((variants, base) => {
        html += `<li><b>${base}</b> → matched as: ${[...variants].join(', ')}</li>`;
    });
    html += `</ul>`;

    container.innerHTML = html;
    card.style.display = 'block';
}

/***********************
 * EXPORT WORD (UNCHANGED)
 ***********************/
function downloadWord() {
    if (!auditHasRun) {
        alert("Please run the 'Run Highlight' audit before exporting.");
        return;
    }

    const wysiwyg = editor.core.context.element.wysiwyg;
    let content = wysiwyg.innerHTML.replace("Paste your content here...", "");

    const styles = `
        <style>
            body { font-family: Arial; font-size: 12pt; }
            .hl-brand { background:#c92d9a;color:#fff;padding:2pt; }
            .hl-keyword { background:#ebe538;color:#000;padding:2pt; }
            .hl-location { background:#15f5f7;color:#000;padding:2pt; }
        </style>`;

    const html = `<html><head>${styles}</head><body>${content}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: "application/msword" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Highlighted-Content-Audit.doc";
    link.click();
}
