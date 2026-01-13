/***********************
 * GLOBAL STATE
 ***********************/
let auditHasRun = false;

/***********************
 * HELPERS
 ***********************/

/**
 * Gets exact colors from the HTML CSS variables
 */
function getStyleColor(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

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
 * Core Scanner: Finds all potential matches in a string
 */
function findMatches(text, list, type, matchesArray) {
    list.forEach(term => {
        const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
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

    if (!brandInput && !keywordInput && !locationInput) {
        alert("Please provide at least one Brand, Keyword, or Location.");
        return;
    }

    if (!content.trim() || content === "Paste your content here...") {
        alert("Please provide content to analyze.");
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

                if (match.type === 'hl-brand') { stats.brand++; usedBrands.add(match.term); }
                else if (match.type === 'hl-keyword') { stats.keyword++; usedKeywords.add(match.term); }
                else if (match.type === 'hl-location') { stats.location++; usedLocations.add(match.term); }
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

    displayUnusedKeywords(
        brands.filter(b => !usedBrands.has(b)),
        keywords.filter(k => !usedKeywords.has(k)),
        locations.filter(l => !usedLocations.has(l))
    );

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
    const renderList = (title, list, colorVar) => {
        if (list.length === 0) return '';
        const color = getStyleColor(colorVar);
        return `
            <div class="unused-list">
                <h4 style="border-bottom: 2px solid ${color}">${title}</h4>
                <ul>${list.map(k => `<li>${k}</li>`).join('')}</ul>
            </div>`;
    };

    html += renderList('Unused Brands', brands, '--brand-color');
    html += renderList('Unused Keywords', keywords, '--keyword-color');
    html += renderList('Unused Locations', locations, '--location-color');

    if (html) {
        container.innerHTML = html;
        card.style.display = 'block';
    } else {
        card.style.display = 'none';
    }
}

/***********************
 * EXPORT WORD (BLACK TEXT, NO BOLD HIGHLIGHTS)
 ***********************/
function downloadWord() {
    if (!auditHasRun) {
        alert("Please run the 'Run Highlight' audit before exporting.");
        return;
    }

    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = getEditorContent();

    const colors = {
        'hl-brand':    getStyleColor('--brand-color'),
        'hl-keyword':  getStyleColor('--keyword-color'),
        'hl-location': getStyleColor('--location-color')
    };

    const allElements = tempContainer.querySelectorAll('*');
    allElements.forEach(el => {
        const tag = el.tagName.toLowerCase();
        // Force text to be black across the whole document
        let style = "color: #000000 !important; font-family: 'Arial', sans-serif;"; 

        if (tag === 'h1') {
            style += "font-size: 18pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt;";
        } else if (tag === 'h2') {
            style += "font-size: 16pt; font-weight: bold; margin-top: 10pt; margin-bottom: 5pt;";
        } else if (tag === 'h3') {
            style += "font-size: 12pt; font-weight: bold; margin-top: 8pt; margin-bottom: 4pt;";
        } else {
            style += "font-size: 12pt; font-weight: normal; margin-bottom: 10pt;";
        }

        // Apply highlights WITHOUT bold and with black text
        if (el.classList.contains('hl-brand')) {
            style += `background-color: ${colors['hl-brand']}; mso-highlight: ${colors['hl-brand']}; font-weight: normal;`;
        } else if (el.classList.contains('hl-keyword')) {
            style += `background-color: ${colors['hl-keyword']}; mso-highlight: yellow; font-weight: normal;`;
        } else if (el.classList.contains('hl-location')) {
            style += `background-color: ${colors['hl-location']}; mso-highlight: cyan; font-weight: normal;`;
        }

        el.setAttribute('style', style);
    });

    const htmlHeader = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial; font-size: 12pt; color: #000000; }
            </style>
        </head>
        <body>
            ${tempContainer.innerHTML}
        </body>
        </html>`;

    const blob = new Blob(['\ufeff', htmlHeader], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SEO_Audit_Report.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
