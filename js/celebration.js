/***********************
 * GLOBAL STATE
 ***********************/
let auditHasRun = false;

/***********************
 * SMART REGEX ENGINE
 ***********************/
function buildPluralRegex(term) {
    const words = term.split(/\s+/);
    const lastWord = words.pop();
    const prefix = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");

    let lastWordRegex;
    const escapedLast = lastWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    if (lastWord.toLowerCase().endsWith("y")) {
        lastWordRegex = `${escapedLast.slice(0, -1)}(y|ies)`;
    } else {
        lastWordRegex = `${escapedLast}(s|es|'s)?`;
    }

    const finalPattern = prefix ? `${prefix}\\s+${lastWordRegex}` : lastWordRegex;
    return `\\b${finalPattern}\\b`;
}

/***********************
 * HELPERS
 ***********************/
function parseLines(input) {
    return [...new Set(input.split(/\n+|\\n/).map(v => v.trim()).filter(Boolean))];
}

function walkTextNodes(node, cb) {
    if (node.nodeType === Node.TEXT_NODE) cb(node);
    else Array.from(node.childNodes).forEach(n => walkTextNodes(n, cb));
}

function clearExistingHighlights(root) {
    const spans = root.querySelectorAll(".hl-brand, .hl-keyword, .hl-location");
    spans.forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
    });
    root.normalize();
}

/***********************
 * MAIN ACTION
 ***********************/
function highlightText() {
    // 1. Get Inputs
    const brandInput = document.getElementById("brand").value;
    const keywordInput = document.getElementById("keywords").value;
    const locationInput = document.getElementById("locations").value;

    const brands = parseLines(brandInput);
    const keywords = parseLines(keywordInput);
    const locations = parseLines(locationInput);

    // 2. Get Content safely from SunEditor
    // This replaces the "getEditorContent is not defined" error
    const rawHTML = sunEditorInstance.getContents();
    
    if (!rawHTML || rawHTML === '<p><br></p>') {
        alert("Please paste content into the editor first.");
        return;
    }

    // 3. Create Processing Workspace
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawHTML;
    clearExistingHighlights(tempDiv);

    let stats = { brand: 0, keyword: 0, location: 0 };
    const usedTermsNormalized = new Set();

    // 4. Find All Matches
    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let allMatches = [];

        const categories = [
            { list: brands, type: 'hl-brand' },
            { list: keywords, type: 'hl-keyword' },
            { list: locations, type: 'hl-location' }
        ];

        categories.forEach(cat => {
            cat.list.forEach(term => {
                const regex = new RegExp(buildPluralRegex(term), "gi");
                let m;
                while ((m = regex.exec(text)) !== null) {
                    allMatches.push({
                        start: m.index,
                        length: m[0].length,
                        type: cat.type,
                        originalTerm: term
                    });
                }
            });
        });

        allMatches.sort((a, b) => (a.start - b.start) || (b.length - a.length));

        const winners = [];
        let lastIndex = 0;
        allMatches.forEach(match => {
            if (match.start >= lastIndex) {
                winners.push(match);
                lastIndex = match.start + match.length;
                usedTermsNormalized.add(match.originalTerm.toLowerCase());
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

    // 5. Push back to SunEditor
    sunEditorInstance.setContents(tempDiv.innerHTML);

    // 6. Update Dashboard
    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    updateUnusedUI(brands, keywords, locations, usedTermsNormalized);
    auditHasRun = true;
}

function updateUnusedUI(brands, keywords, locations, usedSet) {
    const container = document.getElementById("unused-keywords-container");
    container.innerHTML = "";
    
    const renderSection = (title, list) => {
        const unused = list.filter(item => !usedSet.has(item.toLowerCase()));
        if (unused.length > 0) {
            let section = `<div class="unused-list"><h4>${title}</h4><ul>`;
            unused.forEach(item => section += `<li>${item}</li>`);
            container.innerHTML += section + `</ul></div>`;
        }
    };

    renderSection("Unused Brands", brands);
    renderSection("Unused Keywords", keywords);
    renderSection("Unused Locations", locations);
    
    document.getElementById("unused-keywords-card").style.display = container.innerHTML ? "block" : "none";
}

function clearEditor() {
    sunEditorInstance.setContents('');
    document.getElementById("unused-keywords-card").style.display = "none";
    document.getElementById("count-brand").textContent = "0";
    document.getElementById("count-keyword").textContent = "0";
    document.getElementById("count-location").textContent = "0";
    auditHasRun = false;
}

function downloadWord() {
    if (!auditHasRun) return alert("Run Highlight first!");
    const content = sunEditorInstance.getContents();
    const styles = `<style>
        .hl-brand { background-color: #c92d9a; color: #ffffff; padding: 2px; }
        .hl-keyword { background-color: #ebe538; color: #000000; padding: 2px; }
        .hl-location { background-color: #15f5f7; color: #000000; padding: 2px; }
    </style>`;
    const html = `<html><head><meta charset="utf-8">${styles}</head><body>${content}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SEO-Content-Audit.doc";
    a.click();
}
