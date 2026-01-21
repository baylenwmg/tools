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
 * Build singular + plural regex safely
 */
function buildPluralRegex(term) {
    const words = term.split(" ").map(w => {
        if (w.endsWith("y")) {
            return `${escapeRegex(w.slice(0, -1))}(y|ies)`;
        }
        return `${escapeRegex(w)}(s|es)?`;
    });
    return `\\b${words.join("\\s+")}\\b`;
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
 * MATCH ENGINE
 ***********************/
function findMatches(text, list, type, matches) {
    list.forEach(term => {
        const regex = new RegExp(buildPluralRegex(term), "gi");
        let m;
        while ((m = regex.exec(text)) !== null) {
            matches.push({
                start: m.index,
                length: m[0].length,
                type,
                term
            });
        }
    });
}

/***********************
 * MAIN
 ***********************/
function highlightText() {
    const brandInput = document.getElementById("brand").value.trim();
    const keywordInput = document.getElementById("keywords").value.trim();
    const locationInput = document.getElementById("locations").value.trim();

    if (!brandInput || !keywordInput) {
        alert("Please add Brand and Keywords before running highlight.");
        return;
    }

    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);

    const editorRoot = editor.core.context.element.wysiwyg;

    clearExistingHighlights(editorRoot);

    let stats = { brand: 0, keyword: 0, location: 0 };
    const usedBrands = new Set();
    const usedKeywords = new Set();
    const usedLocations = new Set();

    const textNodes = [];
    walkTextNodes(editorRoot, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let matches = [];

        findMatches(text, brands, "hl-brand", matches);
        findMatches(text, keywords, "hl-keyword", matches);
        findMatches(text, locations, "hl-location", matches);

        matches.sort((a, b) =>
            a.start - b.start || b.length - a.length
        );

        let cursor = 0;
        let frag = document.createDocumentFragment();

        matches.forEach(m => {
            if (m.start < cursor) return;

            frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));

            const span = document.createElement("span");
            span.className = m.type;
            span.textContent = text.slice(m.start, m.start + m.length);
            frag.appendChild(span);

            cursor = m.start + m.length;

            if (m.type === "hl-brand") {
                stats.brand++;
                usedBrands.add(m.term);
            } else if (m.type === "hl-keyword") {
                stats.keyword++;
                usedKeywords.add(m.term);
            } else {
                stats.location++;
                usedLocations.add(m.term);
            }
        });

        frag.appendChild(document.createTextNode(text.slice(cursor)));
        node.replaceWith(frag);
    });

    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    displayUnusedKeywords(
        brands.filter(b => !usedBrands.has(b)),
        keywords.filter(k => !usedKeywords.has(k)),
        locations.filter(l => !usedLocations.has(l))
    );

    auditHasRun = true;
}

/***********************
 * UNUSED DISPLAY
 ***********************/
function displayUnusedKeywords(brands, keywords, locations) {
    const container = document.getElementById("unused-keywords-container");
    const card = document.getElementById("unused-keywords-card");

    container.innerHTML = "";

    let html = "";

    if (brands.length) {
        html += `<div class="unused-list"><h4>Unused Brands</h4><ul>${brands.map(v => `<li>${v}</li>`).join("")}</ul></div>`;
    }
    if (keywords.length) {
        html += `<div class="unused-list"><h4>Unused Keywords</h4><ul>${keywords.map(v => `<li>${v}</li>`).join("")}</ul></div>`;
    }
    if (locations.length) {
        html += `<div class="unused-list"><h4>Unused Locations</h4><ul>${locations.map(v => `<li>${v}</li>`).join("")}</ul></div>`;
    }

    if (html) {
        container.innerHTML = html;
        card.style.display = "block";
    } else {
        card.style.display = "none";
    }
}

/***********************
 * EXPORT WORD (UNCHANGED)
 ***********************/
function downloadWord() {
    if (!auditHasRun) {
        alert("Run highlight first.");
        return;
    }

    const html = editor.core.context.element.wysiwyg.innerHTML;
    const blob = new Blob(['\ufeff', html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Highlighted-Content.doc";
    a.click();
}
