let auditHasRun = false;

function parseLines(input) {
    return [...new Set(input.split(/\n/).map(v => v.trim()).filter(Boolean))];
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkTextNodes(node, cb) {
    if (node.nodeType === 3) cb(node);
    else node.childNodes.forEach(n => walkTextNodes(n, cb));
}

function clearExistingHighlights(root) {
    const spans = root.querySelectorAll(".hl-brand, .hl-keyword, .hl-location");
    spans.forEach(span => {
        const textNode = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(textNode, span);
    });
    root.normalize();
}

function findMatches(text, list, type, matchesArray) {
    list.forEach(term => {
        const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
        let m;
        while ((m = regex.exec(text)) !== null) {
            matchesArray.push({ start: m.index, length: m[0].length, type: type, term: term });
        }
    });
}

function highlightText() {
    const brands = parseLines(document.getElementById("brand").value);
    const keywords = parseLines(document.getElementById("keywords").value);
    const locations = parseLines(document.getElementById("locations").value);
    
    // Get content directly from the global sunEditorInstance
    const content = sunEditorInstance.getContents();
    if (!content || content === '<p><br></p>') {
        alert("Please paste content first.");
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    clearExistingHighlights(tempDiv);

    let stats = { brand: 0, keyword: 0, location: 0 };
    const usedTerms = new Set();
    const textNodes = [];
    walkTextNodes(tempDiv, n => textNodes.push(n));

    textNodes.forEach(node => {
        const text = node.nodeValue;
        let matches = [];
        findMatches(text, brands, 'hl-brand', matches);
        findMatches(text, keywords, 'hl-keyword', matches);
        findMatches(text, locations, 'hl-location', matches);

        matches.sort((a, b) => (a.start - b.start) || (b.length - a.length));

        const frag = document.createDocumentFragment();
        let cursor = 0;

        matches.forEach(m => {
            if (m.start < cursor) return;
            frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
            const span = document.createElement("span");
            span.className = m.type;
            span.textContent = text.slice(m.start, m.start + m.length);
            frag.appendChild(span);
            cursor = m.start + m.length;
            usedTerms.add(m.term.toLowerCase());
            
            if (m.type === 'hl-brand') stats.brand++;
            else if (m.type === 'hl-keyword') stats.keyword++;
            else if (m.type === 'hl-location') stats.location++;
        });

        frag.appendChild(document.createTextNode(text.slice(cursor)));
        node.parentNode.replaceChild(frag, node);
    });

    // Push back to SunEditor
    sunEditorInstance.setContents(tempDiv.innerHTML);

    // Update Stats
    document.getElementById("count-brand").textContent = stats.brand;
    document.getElementById("count-keyword").textContent = stats.keyword;
    document.getElementById("count-location").textContent = stats.location;

    // Unused List
    updateUnused(brands, keywords, locations, usedTerms);
    auditHasRun = true;
}

function updateUnused(b, k, l, used) {
    const container = document.getElementById("unused-keywords-container");
    container.innerHTML = '';
    const render = (title, list, cls) => {
        const filtered = list.filter(item => !used.has(item.toLowerCase()));
        if (filtered.length) {
            let html = `<div class="unused-list"><h4>${title}</h4><ul>`;
            filtered.forEach(i => html += `<li>${i}</li>`);
            container.innerHTML += html + `</ul></div>`;
        }
    };
    render("Unused Brands", b, "hl-brand");
    render("Unused Keywords", k, "hl-keyword");
    render("Unused Locations", l, "hl-location");
    document.getElementById("unused-keywords-card").style.display = container.innerHTML ? 'block' : 'none';
}

function clearEditor() {
    sunEditorInstance.setContents('');
    auditHasRun = false;
}

function downloadWord() {
    if (!auditHasRun) return alert("Run Highlight first!");
    const content = sunEditorInstance.getContents();
    const styles = `<style>
        .hl-brand { background-color: #c92d9a; color: #ffffff; }
        .hl-keyword { background-color: #ebe538; color: #000000; }
        .hl-location { background-color: #15f5f7; color: #000000; }
    </style>`;
    const html = `<html><head><meta charset="utf-8">${styles}</head><body>${content}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SEO-Content-Audit.doc"; // PERMANENT FILENAME
    a.click();
}
