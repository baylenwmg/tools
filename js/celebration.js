/***********************
 * GLOBAL STATE
 ***********************/
let auditHasRun = false;

/***********************
 * HELPERS
 ***********************/
function parseLines(input) {
    return [...new Set(input.split(/\n+|\\n/).map(v => v.trim()).filter(Boolean))];
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
    // Select both the classes and any spans with our specific background colors
    const spans = root.querySelectorAll('span[class^="hl-"], span[style*="background-color"]');
    spans.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
    });
    root.normalize();
}

/**
 * FIXED REGEX: Specifically handles plural "NDIS Policy" -> "NDIS Policies"
 */
function buildRegex(term, isAgencyMode) {
    const escapedTerm = escapeRegex(term);
    if (!isAgencyMode) return `\\b${escapedTerm}\\b`;

    const words = escapedTerm.split(/\s+/);
    const lastWord = words.pop();
    const prefix = words.join('\\s+');

    let lastWordRegex;
    if (lastWord.toLowerCase().endsWith('y')) {
        const root = lastWord.slice(0, -1);
        lastWordRegex = `${root}(?:y|ies)`;
    } else {
        lastWordRegex = `${lastWord}(?:s|es|'s)?`;
    }

    const pattern = prefix ? `${prefix}\\s+${lastWordRegex}` : lastWordRegex;
    return `\\b${pattern}\\b`;
}

/***********************
 * MAIN ACTION
 ***********************/
function highlightText() {
    // Get the instance of SunEditor (ensure 'editor' is your global instance)
    if (!editor) {
        alert("Editor not initialized.");
        return;
    }

    const isAgencyMode = document.getElementById('agency-mode-toggle').checked;
    const brands = parseLines(document.getElementById("brand").value);
    const keywords = parseLines(document.getElementById("keywords").value);
    const locations = parseLines(document.getElementById("locations").value);

    // Get raw HTML from editor
    let content = editor.getContents();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    clearExistingHighlights(tempDiv);

    let stats = { brand: 0, keyword: 0, location: 0 };
    const usedTermsNormalized = new Set();

    // Configuration for colors (Force inline styles)
    const configs = [
        { list: brands, type: 'hl-brand', color: '#c92d9a', textColor: '#ffffff' },
        { list: keywords, type: 'hl-keyword', color: '#ebe538', textColor: '#000000' },
        { list: locations, type: 'hl-location', color: '#15f5f7', textColor: '#000000' }
    ];

    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let allMatches = [];

        configs.forEach(config => {
            config.list.forEach(term => {
                const regex = new RegExp(buildRegex(term, isAgencyMode), "gi");
                let m;
                while ((m = regex.exec(text)) !== null) {
                    allMatches.push({ ...config, start: m.index, length: m[0].length, term: term });
                }
            });
        });

        // Longest match priority
        allMatches.sort((a, b) => (a.start - b.start) || (b.length - a.length));

        const winners = [];
        let lastIndex = 0;
        allMatches.forEach(match => {
            if (match.start >= lastIndex) {
                winners.push(match);
                lastIndex = match.start + match.length;
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
                // FORCE STYLES so SunEditor can't hide them
                span.style.backgroundColor = m.color;
                span.style.color = m.textColor;
                span.style.padding = "2px 4px";
                span.style.borderRadius = "3px";
                span.textContent = text.slice(m.start, m.start + m.length);
                frag.appendChild(span);
                cursor = m.start + m.length;
            });
            frag.appendChild(document.createTextNode(text.slice(cursor)));
            node.parentNode.replaceChild(frag, node);
        }
    });

    // Push back to SunEditor
    editor.setContents(tempDiv.innerHTML);
    
    // Update Stats
    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    // Update Unused
    displayUnusedKeywords(
        brands.filter(b => !usedTermsNormalized.has(b.toLowerCase())),
        keywords.filter(k => !usedTermsNormalized.has(k.toLowerCase())),
        locations.filter(l => !usedTermsNormalized.has(l.toLowerCase()))
    );

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
