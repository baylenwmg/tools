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
 * Exact String Matcher:
 * Matches the exact sequence of characters anywhere in the text.
 * No word boundaries (\b) used, so "Mechanic" will match "Mechanic", "Mechanics", 
 * or even "Telemechanic".
 */
function findMatches(text, list, type, matchesArray) {
    list.forEach(term => {
        if (!term) return;
        
        // Removed \b so it matches the exact string anywhere
        const escapedTerm = escapeRegex(term);
        const regex = new RegExp(escapedTerm, "gi");
        
        let m;
        regex.lastIndex = 0; 

        while ((m = regex.exec(text)) !== null) {
            // Safety to prevent infinite loops
            if (m.index === regex.lastIndex) regex.lastIndex++;

            matchesArray.push({
                start: m.index,
                length: term.length, // Highlights only the exact characters entered
                type: type,
                text: text.substring(m.index, m.index + term.length),
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

        findMatches(text, brands, 'hl-brand', allMatches);
        findMatches(text, keywords, 'hl-keyword', allMatches);
        findMatches(text, locations, 'hl-location', allMatches);

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
    container.innerHTML = ''; 

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

    const placeholder = "Paste your content here...";
    if (content.includes(placeholder)) {
        content = content.replace(placeholder, "");
    }

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
