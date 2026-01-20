/**
 * GLOBAL CONFIG
 */
let auditHasRun = false;
// Note: Ensure your HTML matches this ID or the SunEditor logic
const editorNode = document.getElementById('content'); 

/**
 * NATIVE EDITOR UTILS
 */
function clearEditor() {
    if (typeof editor !== 'undefined') {
        editor.setContents('');
    } else {
        editorNode.innerHTML = "Paste your content here...";
    }
    document.getElementById("count-brand").textContent = "0";
    document.getElementById("count-keyword").textContent = "0";
    document.getElementById("count-location").textContent = "0";
    document.getElementById("unused-keywords-card").style.display = 'none';
    auditHasRun = false;
}

/**
 * CORE LOGIC HELPERS
 */
function getStyleColor(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

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
    const spans = root.querySelectorAll(".hl-brand, .hl-keyword, .hl-location");
    spans.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
    });
    root.normalize();
}

/**
 * UPDATED: Phrase-Aware and Plural-Smart Matching
 */
function findMatches(text, list, type, matchesArray) {
    const isFlexible = document.getElementById("flexible-match").checked;

    list.forEach(term => {
        let pattern = escapeRegex(term);

        let regex;
        if (isFlexible) {
            // Handle "y" to "ies" (e.g., Policy -> Policies)
            if (pattern.toLowerCase().endsWith('y')) {
                const root = pattern.slice(0, -1);
                regex = new RegExp(`\\b${root}(?:y|ies)(?:s|'s)?\\b`, "gi");
            } else {
                // Matches phrase + standard plurals (e.g., Premium Car -> Premium Cars)
                regex = new RegExp(`\\b${pattern}(?:s|es|'s)?\\b`, "gi");
            }
        } else {
            // Strict Mode: Exact match only
            regex = new RegExp(`\\b${pattern}\\b`, "gi");
        }
        
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

/**
 * MAIN HIGHLIGHT FUNCTION
 */
function highlightText() {
    const brandInput = document.getElementById("brand").value.trim();
    const keywordInput = document.getElementById("keywords").value.trim();
    const locationInput = document.getElementById("locations").value.trim();
    
    // Support for SunEditor content retrieval
    const content = (typeof getEditorContent === 'function') ? getEditorContent() : editorNode.innerHTML;

    if (!content || content.includes("Paste your content here")) {
        alert("Please paste some content first.");
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

    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let allMatches = [];
        findMatches(text, brands, 'hl-brand', allMatches);
        findMatches(text, keywords, 'hl-keyword', allMatches);
        findMatches(text, locations, 'hl-location', allMatches);

        const typePriority = { 'hl-brand': 1, 'hl-keyword': 2, 'hl-location': 3 };
        allMatches.sort((a, b) => (a.start - b.start) || (b.length - a.length) || (typePriority[a.type] - typePriority[b.type]));

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

    // Unused Keywords Logic
    const unusedContainer = document.getElementById("unused-keywords-container");
    const unusedCard = document.getElementById("unused-keywords-card");
    unusedContainer.innerHTML = '';
    let html = '';
    const renderList = (title, list, usedSet, colorVar) => {
        const unused = list.filter(item => !usedSet.has(item));
        if (unused.length === 0) return '';
        return `<div class="unused-list"><h4 style="border-color:${getStyleColor(colorVar)}">${title}</h4><ul>${unused.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
    };
    html += renderList('Unused Brands', brands, usedBrands, '--brand-color');
    html += renderList('Unused Keywords', keywords, usedKeywords, '--keyword-color');
    html += renderList('Unused Locations', locations, usedLocations, '--location-color');
    
    if (html) { unusedContainer.innerHTML = html; unusedCard.style.display = 'block'; }
    else { unusedCard.style.display = 'none'; }

    // Re-insert into Editor
    if (typeof editor !== 'undefined') {
        editor.setContents(tempDiv.innerHTML);
    } else {
        editorNode.innerHTML = tempDiv.innerHTML;
    }
    auditHasRun = true;
}

/**
 * EXPORT TO WORD
 */
function downloadWord() {
    if (!auditHasRun) {
        alert("Run Highlight first.");
        return;
    }

    const contentSource = (typeof getEditorContent === 'function') ? getEditorContent() : editorNode.innerHTML;
    const temp = document.createElement('div');
    temp.innerHTML = contentSource;

    const colors = {
        'hl-brand': getStyleColor('--brand-color') || '#c92d9a',
        'hl-keyword': getStyleColor('--keyword-color') || '#ebe538',
        'hl-location': getStyleColor('--location-color') || '#15f5f7'
    };

    temp.querySelectorAll('*').forEach(el => {
        const tag = el.tagName.toLowerCase();
        let style = "color: #000000 !important; font-family: 'Arial', sans-serif;";

        if (tag === 'h1') style += "font-size: 18pt; font-weight: bold; margin-bottom: 10pt;";
        else if (tag === 'h2') style += "font-size: 16pt; font-weight: bold; margin-bottom: 8pt;";
        else if (tag === 'h3') style += "font-size: 12pt; font-weight: bold; margin-bottom: 6pt;";
        else style += "font-size: 12pt; font-weight: normal; margin-bottom: 10pt;";

        if (el.classList.contains('hl-brand')) style += `background-color: ${colors['hl-brand']}; mso-highlight: ${colors['hl-brand']};`;
        else if (el.classList.contains('hl-keyword')) style += `background-color: ${colors['hl-keyword']}; mso-highlight: yellow;`;
        else if (el.classList.contains('hl-location')) style += `background-color: ${colors['hl-location']}; mso-highlight: cyan;`;

        el.setAttribute('style', style);
    });

    const blob = new Blob(['\ufeff', `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset="utf-8"></head>
        <body>${temp.innerHTML}</body>
        </html>`], { type: "application/msword" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Highlighted-Report.doc";
    link.click();
}
