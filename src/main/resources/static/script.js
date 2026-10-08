// The operations the user can pick. The keys must match the names used by the Java server.
const OPERATIONS = {
    toBase64:   { label: "To Base64",   icon: "\uD83D\uDCE6", group: "Encoding", tone: "teal",   blurb: "Rewrite text using only safe letters and digits." },
    fromBase64: { label: "From Base64", icon: "\uD83D\uDCEC", group: "Encoding", tone: "teal",   blurb: "Turn Base64 text back into normal text." },
    urlEncode:  { label: "URL encode",  icon: "\uD83D\uDD17", group: "Web",      tone: "blue",   blurb: "Make text safe to put in a web address." },
    urlDecode:  { label: "URL decode",  icon: "\uD83D\uDD13", group: "Web",      tone: "blue",   blurb: "Read web-address text as normal text again." },
    rot13:      { label: "ROT13",       icon: "\uD83D\uDD24", group: "Cipher",   tone: "pink",   blurb: "Swap every letter with the one 13 places later." },
    sha256:     { label: "SHA-256",     icon: "\uD83E\uDDEC", group: "Hashing",  tone: "orange", blurb: "Turn any text into a unique 64-character fingerprint." }
};

const availableOperations = Object.keys(OPERATIONS);

// Ready-made recipes for people who do not know where to start
const EXAMPLES = [
    { icon: "\uD83E\uDDEC", title: "Fingerprint, then Base64, then ROT13", input: "hello", steps: ["sha256", "toBase64", "rot13"] },
    { icon: "\uD83D\uDD17", title: "Make text web-safe", input: "fish & chips?", steps: ["urlEncode"] },
    { icon: "\uD83D\uDCE6", title: "Hide text with Base64", input: "Hello, DataForge!", steps: ["toBase64"] },
    { icon: "\uD83D\uDD24", title: "Secret letters", input: "Meet me at noon", steps: ["rot13"] }
];

let recipe = [];

function renderOperationList() {
    const container = document.getElementById("operation-list");
    container.replaceChildren();

    for (const opName of availableOperations) {
        const op = OPERATIONS[opName];

        const button = document.createElement("button");
        button.type = "button";
        button.className = "op-card tone-" + op.tone;
        button.title = "Add " + op.label + " to your recipe";
        button.onclick = () => addToRecipe(opName);

        const icon = document.createElement("span");
        icon.className = "op-icon";
        icon.textContent = op.icon;

        const text = document.createElement("span");
        text.className = "op-text";
        const name = document.createElement("b");
        name.textContent = op.label;
        const blurb = document.createElement("small");
        blurb.textContent = op.blurb;
        text.append(name, blurb);

        const tag = document.createElement("span");
        tag.className = "op-tag";
        tag.textContent = op.group;

        const plus = document.createElement("span");
        plus.className = "op-plus";
        plus.textContent = "+";

        button.append(icon, text, tag, plus);
        container.appendChild(button);
    }
}

function renderExamples() {
    const container = document.getElementById("example-list");
    container.replaceChildren();

    for (const example of EXAMPLES) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "example-chip";
        button.textContent = example.icon + "  " + example.title;
        button.onclick = () => loadExample(example);
        container.appendChild(button);
    }
}

function loadExample(example) {
    recipe = example.steps.map((name) => ({ name: name, params: {} }));
    document.getElementById("input-box").value = example.input;
    renderRecipeList(false);
    bake();
}

function addToRecipe(opName) {
    recipe.push({ name: opName, params: {} });
    renderRecipeList(true);
}

function removeFromRecipe(index) {
    recipe.splice(index, 1);
    renderRecipeList(true);
}

// resetLesson: the lesson shown below belongs to the old recipe, so hide it when the recipe changes
function renderRecipeList(resetLesson) {
    const container = document.getElementById("recipe-list");
    container.replaceChildren();

    if (resetLesson) {
        document.getElementById("explanation").hidden = true;
    }

    if (recipe.length === 0) {
        const empty = document.createElement("div");
        empty.className = "recipe-empty";
        empty.textContent = "Your recipe is empty. Pick an operation on the left, or try an example above.";
        container.appendChild(empty);
        return;
    }

    recipe.forEach((step, index) => {
        const op = OPERATIONS[step.name] || { label: step.name, icon: "\u2699\uFE0F", tone: "blue" };

        const row = document.createElement("div");
        row.className = "recipe-step tone-" + op.tone;

        const number = document.createElement("span");
        number.className = "recipe-num";
        number.textContent = String(index + 1);

        const icon = document.createElement("span");
        icon.className = "recipe-icon";
        icon.textContent = op.icon;

        const label = document.createElement("span");
        label.className = "recipe-label";
        label.textContent = op.label;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-btn";
        removeButton.title = "Remove this step";
        removeButton.textContent = "\u00D7";
        removeButton.onclick = () => removeFromRecipe(index);

        row.append(number, icon, label, removeButton);
        container.appendChild(row);
    });
}

async function bake() {
    const input = document.getElementById("input-box").value;
    const outputBox = document.getElementById("output-box");
    const bakeButton = document.getElementById("bake-button");

    bakeButton.disabled = true;
    bakeButton.textContent = "Baking...";

    try {
        const response = await fetch("/api/bake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: input, recipe: recipe })
        });

        if (!response.ok) {
            outputBox.value = "Something went wrong on the server (" + response.status + "). "
                + "Check that the input suits the recipe, for example From Base64 needs real Base64 text.";
            document.getElementById("explanation").hidden = true;
            return;
        }

        const data = await response.json();
        outputBox.value = data.output;

        // Show the plain-English story and lessons for every step of the recipe
        renderExplanation(data.steps);

        if (recipe.length > 0) {
            document.getElementById("explanation").scrollIntoView({ behavior: "smooth", block: "start" });
        }
    } catch (error) {
        outputBox.value = "Could not reach the server. Is the app running at http://localhost:8080 ?";
    } finally {
        bakeButton.disabled = false;
        bakeButton.textContent = "Bake it and show me how";
    }
}

document.getElementById("bake-button").onclick = bake;

renderOperationList();
renderExamples();
renderRecipeList(false);