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

function clearExistingHighlights(root) {
    const spans = root.querySelectorAll(".hl-brand, .hl-keyword, .hl-location");
    spans.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
    });
    root.normalize();
}

/**
 * CORE SCANNER
 * Finds exact string matches anywhere in the text.
 */
function findMatches(text, list, type, matchesArray) {
    list.forEach(term => {
        if (!term || term.trim() === "") return;
        
        const regex = new RegExp(escapeRegex(term), "gi");
        let m;
        while ((m = regex.exec(text)) !== null) {
            matchesArray.push({
                start: m.index,
                length: term.length,
                type: type,
                term: term 
            });
            if (m.index === regex.lastIndex) regex.lastIndex++;
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

    if (!brandInput && !keywordInput && !locationInput) {
        alert("Please provide at least one Brand, Keyword, or Location.");
        return;
    }

    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);
    
    let stats = { brand: 0, keyword: 0, location: 0 };
    const usedTerms = new Set();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    clearExistingHighlights(tempDiv);

    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let allMatches = [];

        findMatches(text, brands, 'hl-brand', allMatches);
        findMatches(text, keywords, 'hl-keyword', allMatches);
        findMatches(text, locations, 'hl-location', allMatches);

        // SORT: Longest strings first. This prevents "Sydney" from blocking "All Sydney Mobile Mechanic"
        allMatches.sort((a, b) => b.length - a.length || a.start - b.start);

        const winners = [];
        const occupied = new Array(text.length).fill(false);

        allMatches.forEach(match => {
            let canFit = true;
            for (let i = match.start; i < match.start + match.length; i++) {
                if (occupied[i]) {
                    canFit = false;
                    break;
                }
            }

            if (canFit) {
                winners.push(match);
                for (let i = match.start; i < match.start + match.length; i++) {
                    occupied[i] = true;
                }
                
                if (match.type === 'hl-brand') stats.brand++;
                if (match.type === 'hl-keyword') stats.keyword++;
                if (match.type === 'hl-location') stats.location++;
                usedTerms.add(match.term);
            }
        });

        // Reconstruct the node with highlights
        if (winners.length > 0) {
            winners.sort((a, b) => a.start - b.start);
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

    // Update Dashboard
    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    displayUnusedKeywords(
        brands.filter(t => !usedTerms.has(t)),
        keywords.filter(t => !usedTerms.has(t)),
        locations.filter(t => !usedTerms.has(t))
    );

    editor.setContents(tempDiv.innerHTML);
    auditHasRun = true;
}

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

function downloadWord() {
    if (!auditHasRun) {
        alert("Please run 'Run Highlight' first.");
        return;
    }
    const content = editor.getContents();
    const styles = `<style>
        body { font-family: Arial; font-size: 12pt; }
        .hl-brand { background-color: #c92d9a; color: #ffffff; padding: 2px; }
        .hl-keyword { background-color: #ebe538; color: #000000; padding: 2px; }
        .hl-location { background-color: #15f5f7; color: #000000; padding: 2px; }
    </style>`;

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset="utf-8">${styles}</head>
        <body>${content}</body></html>`;

    const blob = new Blob(['\ufeff', html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Highlighted-Content.doc";
    link.click();
}
