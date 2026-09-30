const availableOperations = ["toBase64", "fromBase64", "rot13", "urlEncode", "urlDecode", "sha256"];

let recipe = [];

function renderOperationList() {
    const container = document.getElementById("operation-list");
    container.innerHTML = "";

    for (const opName of availableOperations) {
        const button = document.createElement("button");
        button.textContent = opName;
        button.onclick = () => addToRecipe(opName);
        container.appendChild(button);
    }
}

function addToRecipe(opName) {
    recipe.push({ name: opName, params: {} });
    renderRecipeList();
}

function removeFromRecipe(index) {
    recipe.splice(index, 1);
    renderRecipeList();
}

function renderRecipeList() {
    const container = document.getElementById("recipe-list");
    container.innerHTML = "";

    recipe.forEach((step, index) => {
        const row = document.createElement("div");
        row.className = "recipe-step";

        const label = document.createElement("span");
        label.textContent = step.name;

        const removeButton = document.createElement("button");
        removeButton.textContent = "x";
        removeButton.className = "remove-btn";
        removeButton.onclick = () => removeFromRecipe(index);

        row.appendChild(label);
        row.appendChild(removeButton);
        container.appendChild(row);
    });
}

async function bake() {
    const input = document.getElementById("input-box").value;

    const response = await fetch("/api/bake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input, recipe: recipe })
    });

    const data = await response.json();
    document.getElementById("output-box").value = data.output;
}

document.getElementById("bake-button").onclick = bake;

renderOperationList();