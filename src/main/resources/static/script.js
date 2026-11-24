// The operations the user can pick. The keys must match the names used by the Java server.
const OPERATIONS = {
    toBase64:   { label: "To Base64",   glyph: "b64", group: "Encoding", tone: "teal",   blurb: "Rewrite text using only safe letters and digits." },
    fromBase64: { label: "From Base64", glyph: "b64", group: "Decoding", tone: "teal",   blurb: "Turn Base64 text back into normal text." },
    urlEncode:  { label: "URL encode",  glyph: "%",   group: "Web",      tone: "blue",   blurb: "Make text safe to put in a web address." },
    urlDecode:  { label: "URL decode",  glyph: "%",   group: "Web",      tone: "blue",   blurb: "Read web-address text as normal text again." },
    rot13:      { label: "ROT13",       glyph: "13",  group: "Cipher",   tone: "pink",   blurb: "Swap every letter with the one 13 places later." },
    sha256:     { label: "SHA-256",     glyph: "#",   group: "Hashing",  tone: "orange", blurb: "Turn any text into a unique 64-character fingerprint." }
};

// Ready-made recipes for people who do not know where to start
const EXAMPLES = [
    { title: "Fingerprint, then Base64, then ROT13", input: "hello", steps: ["sha256", "toBase64", "rot13"] },
    { title: "Make text web-safe", input: "fish & chips?", steps: ["urlEncode"] },
    { title: "Hide text with Base64", input: "Hello, DataForge!", steps: ["toBase64"] },
    { title: "Secret letters", input: "Meet me at noon", steps: ["rot13"] }
];

let recipe = [];
let lastSteps = null;   // results of the latest bake, used to preview each step's output

const inputEl = document.getElementById("input-text");
const outputEl = document.getElementById("output-text");
const bakeBtn = document.getElementById("bake-btn");
const copyBtn = document.getElementById("copy-btn");
const clearBtn = document.getElementById("clear-btn");
const errorEl = document.getElementById("bake-error");
const searchEl = document.getElementById("op-search");

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function shortText(text, max) {
    return text.length > max ? text.slice(0, max) + "\u2026" : text;
}

function countText(text) {
    const n = Array.from(text).length;
    return n + (n === 1 ? " character" : " characters");
}

// ---- operations list (grouped, searchable) ----

function renderTools() {
    const container = document.getElementById("operation-list");
    container.replaceChildren();

    const query = searchEl.value.trim().toLowerCase();
    const groups = new Map();

    for (const [name, op] of Object.entries(OPERATIONS)) {
        const haystack = (op.label + " " + op.blurb + " " + op.group).toLowerCase();
        if (query && !haystack.includes(query)) continue;
        if (!groups.has(op.group)) groups.set(op.group, []);
        groups.get(op.group).push([name, op]);
    }

    if (groups.size === 0) {
        container.appendChild(el("p", "df-nomatch", "No operation matches \u201C" + searchEl.value.trim() + "\u201D."));
        return;
    }

    for (const [groupName, items] of groups) {
        const group = el("div", "df-group");
        group.appendChild(el("h3", "df-group-title", groupName));

        for (const [name, op] of items) {
            const button = el("button", "df-tool tone-" + op.tone);
            button.type = "button";
            button.title = "Add " + op.label + " to your recipe";
            button.onclick = () => addToRecipe(name);
            button.append(
                el("span", "df-glyph", op.glyph),
                el("span", "df-tool-name", op.label),
                el("span", "df-tool-blurb", op.blurb)
            );
            group.appendChild(button);
        }
        container.appendChild(group);
    }
}

function renderExamples() {
    const container = document.getElementById("example-list");
    container.replaceChildren();

    for (const example of EXAMPLES) {
        const button = el("button", "df-chip", example.title);
        button.type = "button";
        button.onclick = () => loadExample(example);
        container.appendChild(button);
    }
}

// ---- recipe ----

function loadExample(example) {
    recipe = example.steps.map((name) => ({ name: name, params: {} }));
    inputEl.value = example.input;
    updateInputCount();
    renderRecipe(false);
    bake();
}

function addToRecipe(opName) {
    recipe.push({ name: opName, params: {} });
    renderRecipe(true);
}

function removeFromRecipe(index) {
    recipe.splice(index, 1);
    renderRecipe(true);
}

// invalidate: the old results belong to the old recipe, so drop them when the recipe changes
function renderRecipe(invalidate) {
    if (invalidate) {
        lastSteps = null;
        document.getElementById("explanation").hidden = true;
    }

    const container = document.getElementById("recipe-list");
    container.replaceChildren();
    clearBtn.hidden = recipe.length === 0;

    if (recipe.length === 0) {
        container.appendChild(el("div", "df-empty",
            "No steps yet. Pick an operation on the left, or load an example."));
        return;
    }

    recipe.forEach((step, index) => {
        const op = OPERATIONS[step.name] || { label: step.name, tone: "blue" };

        const row = el("div", "df-rstep tone-" + op.tone);
        row.style.setProperty("--i", index);

        const remove = el("button", "df-rstep-del", "\u00D7");
        remove.type = "button";
        remove.title = "Remove this step";
        remove.setAttribute("aria-label", "Remove step " + (index + 1) + ", " + op.label);
        remove.onclick = () => removeFromRecipe(index);

        row.append(el("span", "df-rstep-no", String(index + 1)), el("span", "df-rstep-name", op.label), remove);

        if (lastSteps && lastSteps[index]) {
            const out = el("div", "df-rstep-out", shortText(lastSteps[index].output, 60));
            out.title = lastSteps[index].output;
            row.appendChild(out);
        }
        container.appendChild(row);
    });
}

// ---- messages and small helpers ----

function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
}

function hideError() {
    errorEl.hidden = true;
}

function updateInputCount() {
    document.getElementById("input-count").textContent = countText(inputEl.value);
}

function updateOutputCount() {
    document.getElementById("output-count").textContent = outputEl.value ? countText(outputEl.value) : "";
}

async function copyOutput() {
    const text = outputEl.value;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        outputEl.select();
        document.execCommand("copy");
    }
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1400);
}

// ---- bake ----

async function bake() {
    hideError();
    bakeBtn.disabled = true;
    bakeBtn.textContent = "Baking...";

    try {
        const response = await fetch("/api/bake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: inputEl.value, recipe: recipe })
        });

        if (!response.ok) {
            let message = "The server returned an error (" + response.status + ").";
            try {
                const err = await response.json();
                if (err.error) message = err.error;
            } catch (ignored) {
                // no JSON body, keep the generic message
            }
            showError(message);
            outputEl.value = "";
            updateOutputCount();
            lastSteps = null;
            renderRecipe(false);
            document.getElementById("explanation").hidden = true;
            return;
        }

        const data = await response.json();
        outputEl.value = data.output;
        updateOutputCount();

        lastSteps = data.steps;
        renderRecipe(false);

        // Plain-English story and lessons for every step (drawn by Explain.js)
        renderExplanation(data.steps);

        if (recipe.length > 0) {
            document.getElementById("explanation").scrollIntoView({ behavior: "smooth", block: "start" });
        }
    } catch (error) {
        showError("Could not reach the server. Is the app running at http://localhost:8080 ?");
    } finally {
        bakeBtn.disabled = false;
        bakeBtn.textContent = "Bake and show me how";
    }
}

// ---- wiring ----

bakeBtn.onclick = bake;
copyBtn.onclick = copyOutput;
clearBtn.onclick = () => { recipe = []; renderRecipe(true); };
searchEl.oninput = renderTools;
inputEl.addEventListener("input", updateInputCount);
inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        bake();
    }
});

renderTools();
renderExamples();
renderRecipe(false);
updateInputCount();