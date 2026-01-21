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

/**
 * FIXED REGEX ENGINE
 * Only pluralizes the LAST word of a phrase (e.g., NDIS Policies)
 */
function buildPluralRegex(term) {
    const words = term.split(/\s+/);
    const lastWord = words.pop();
    const prefix = words.map(w => escapeRegex(w)).join("\\s+");

    let lastWordRegex;
    if (lastWord.toLowerCase().endsWith("y")) {
        const root = lastWord.slice(0, -1);
        lastWordRegex = `${escapeRegex(root)}(y|ies)`;
    } else {
        lastWordRegex = `${escapeRegex(lastWord)}(s|es|'s)?`;
    }

    const finalPattern = prefix ? `${prefix}\\s+${lastWordRegex}` : lastWordRegex;
    return `\\b${finalPattern}\\b`;
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
                type: type,
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

    if (!brandInput && !keywordInput) {
        alert("Please add Brand or Keywords before running the highlight.");
        return;
    }

    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);

    // Get official editor content
    const content = editor.getContents();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;

    // Clear previous audit
    clearExistingHighlights(tempDiv);

    let stats = { brand: 0, keyword: 0, location: 0 };
    const usedTerms = new Set();

    // Process Text Nodes
    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let matches = [];

        findMatches(text, brands, "hl-brand", matches);
        findMatches(text, keywords, "hl-keyword", matches);
        findMatches(text, locations, "hl-location", matches);

        matches.sort((a, b) => a.start - b.start || b.length - a.length);

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
            usedTerms.add(m.term.toLowerCase());

            if (m.type === "hl-brand") stats.brand++;
            else if (m.type === "hl-keyword") stats.keyword++;
            else if (m.type === "hl-location") stats.location++;
        });

        frag.appendChild(document.createTextNode(text.slice(cursor)));
        node.replaceWith(frag);
    });

    // Update SunEditor
    editor.setContents(tempDiv.innerHTML);

    // Update Stats
    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    // Refresh Unused list
    displayUnusedKeywords(
        brands.filter(b => !usedTerms.has(b.toLowerCase())),
        keywords.filter(k => !usedTerms.has(k.toLowerCase())),
        locations.filter(l => !usedTerms.has(l.toLowerCase()))
    );

    auditHasRun = true;
}

/***********************
 * UNUSED KEYWORDS DISPLAY
 ***********************/
function displayUnusedKeywords(brands, keywords, locations) {
    const container = document.getElementById("unused-keywords-container");
    const card = document.getElementById("unused-keywords-card");
    container.innerHTML = "";

    let html = "";
    const buildList = (title, list, colorClass) => {
        if (list.length > 0) {
            html += `<div class="unused-list">
                <h4 class="${colorClass}">${title}</h4>
                <ul>${list.map(v => `<li>${v}</li>`).join("")}</ul>
            </div>`;
        }
    };

    buildList("Unused Brands", brands, "brand-border");
    buildList("Unused Keywords", keywords, "keyword-border");
    buildList("Unused Locations", locations, "location-border");

    if (html) {
        container.innerHTML = html;
        card.style.display = "block";
    } else {
        card.style.display = "none";
    }
}

/***********************
 * EXPORT WORD
 ***********************/
function downloadWord() {
    if (!auditHasRun) {
        alert("Please run highlight audit first.");
        return;
    }

    const content = editor.getContents();
    
    // Add specific Word styling for colors
    const styles = `
        <style>
            .hl-brand { background-color: #c92d9a; color: #ffffff; }
            .hl-keyword { background-color: #ebe538; color: #000000; }
            .hl-location { background-color: #15f5f7; color: #000000; }
        </style>
    `;

    const html = `<html><head><meta charset="utf-8">${styles}</head><body>${content}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);

    // CONSTANT FILE NAME: Fixed to 'SEO-Content-Audit.doc'
    const a = document.createElement("a");
    a.href = url;
    a.download = "SEO-Content-Audit.doc";
    a.click();
    
    window.URL.revokeObjectURL(url);
}
