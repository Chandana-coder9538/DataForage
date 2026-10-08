/*
 * explain.js - draws the "How it works" learning panel.
 *
 * Input: the `steps` array returned by POST /api/bake. Each step looks like
 *   { name, input, output, details: [ { title, explanation, data }, ... ] }
 *
 * Everything is drawn with plain DOM elements (no libraries). All text goes
 * through textContent, so whatever the user types can never become HTML.
 */
(function () {
    "use strict";

    // ======================================================================
    // Small helpers
    // ======================================================================

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function put(parent, ...children) {
        children.forEach(function (child) {
            if (child) parent.appendChild(child);
        });
        return parent;
    }

    function makeButton(text, title, onClick, className) {
        const b = el("button", className, text);
        b.type = "button";
        if (title) b.title = title;
        b.onclick = onClick;
        return b;
    }

    function section(title, subtitle) {
        const s = el("div", "vis-section");
        s.appendChild(el("h4", "vis-title", title));
        if (subtitle) s.appendChild(el("p", "vis-sub", subtitle));
        return s;
    }

    // ---- 32-bit math, the same operations the Java side uses ----
    const u32 = (n) => n >>> 0;
    const hex8 = (n) => u32(n).toString(16).padStart(8, "0");
    const toInt = (h) => parseInt(h, 16) >>> 0;
    const bin32 = (n) => u32(n).toString(2).padStart(32, "0");
    const rotr = (x, n) => u32((x >>> n) | (x << (32 - n)));
    const add32 = (...xs) => u32(xs.reduce((sum, x) => sum + x, 0));

    const sig0 = (x) => u32(rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3));      // small sigma 0
    const sig1 = (x) => u32(rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10));    // small sigma 1
    const SIG0 = (x) => u32(rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22));    // big Sigma 0
    const SIG1 = (x) => u32(rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25));    // big Sigma 1
    const ch = (e, f, g) => u32((e & f) ^ (~e & g));
    const maj = (a, b, c) => u32((a & b) ^ (a & c) ^ (b & c));

    function chunk(str, size) {
        const out = [];
        for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
        return out;
    }

    // ---- bit pictures ----

    /** One row of 32 little squares. classFn(i, bitChar) can add extra classes per bit. */
    function bitRow(value, classFn) {
        const row = el("div", "bitrow");
        const s = bin32(value);
        for (let i = 0; i < 32; i++) {
            let cls = "bit " + (s[i] === "1" ? "on" : "off");
            if (i % 8 === 7 && i < 31) cls += " gap";
            if (classFn) cls += " " + (classFn(i, s[i]) || "");
            row.appendChild(el("span", cls));
        }
        return row;
    }

    /** label + 32 bits + hex value, on one line. */
    function bitLine(label, value, classFn, extraClass) {
        const line = el("div", "bitline" + (extraClass ? " " + extraClass : ""));
        return put(line,
            el("span", "bitlabel", label),
            bitRow(value, classFn),
            el("span", "bithex", hex8(value)));
    }

    function term(name, value, cls) {
        return put(el("div", "term " + (cls || "")),
            el("span", "term-name", name),
            el("span", "term-val", hex8(value)));
    }

    function opSign(symbol) {
        return el("span", "op-sign", symbol);
    }

    // ======================================================================
    // Panel state and navigation
    // ======================================================================

    let allSteps = [];    // every recipe step, in order
    let tabs = [];        // steps that have a walkthrough: { step, position }
    let tabIndex = 0;     // which of those is open in the lesson
    let cardIndex = 0;    // which card of that walkthrough is showing
    let timer = null;     // used by the round-by-round animation
    let simple = true;    // plain words by default; "Show the math" switches to technical

    // Everyday descriptions used in the story at the top of the panel
    const PLAIN = {
        toBase64: { icon: "\uD83D\uDCE6", title: "To Base64", text: "Rewrites your text using only 64 safe symbols (letters, digits, + and /), so it can travel through places that only understand plain text." },
        fromBase64: { icon: "\uD83D\uDCEC", title: "From Base64", text: "Turns Base64 text back into the original text." },
        rot13: { icon: "\uD83D\uDD24", title: "ROT13", text: "Swaps every letter with the letter 13 places further along the alphabet (a becomes n, b becomes o). Doing it twice brings the original back." },
        urlEncode: { icon: "\uD83D\uDD17", title: "URL encode", text: "Makes text safe to put inside a web address. Characters that have a special job in addresses (like a space, & or ?) are replaced by a % and a short code." },
        urlDecode: { icon: "\uD83D\uDD13", title: "URL decode", text: "Undoes URL encoding: every % code is turned back into the real character." },
        sha256: { icon: "\uD83E\uDDEC", title: "SHA-256", text: "Turns text of any length into a fixed 64-character fingerprint. The same text always gives the same fingerprint, but you can never get the text back from it." }
    };

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function shortText(text, max) {
        return text.length > max ? text.slice(0, max) + "\u2026" : text;
    }

    /** Text in a code box where pieces matching `re` (one capture group) are highlighted. */
    function marked(text, re) {
        const code = el("code", "marked");
        text.split(re).forEach(function (piece, i) {
            if (piece === "") return;
            code.appendChild(i % 2 === 1 ? el("span", "hl", piece) : document.createTextNode(piece));
        });
        return code;
    }

    function lessonCards() {
        const cards = tabs[tabIndex].step.details;
        return simple ? cards.filter(function (c) { return !c.data.techOnly; }) : cards;
    }

    function goTo(index) {
        const count = lessonCards().length;
        cardIndex = Math.max(0, Math.min(count - 1, index));
        renderCard();
    }

    /** Called by script.js after every Bake. */
    window.renderExplanation = function (steps) {
        stopTimer();
        allSteps = steps || [];
        tabs = [];
        allSteps.forEach(function (step, position) {
            if (step.details && step.details.length > 0) tabs.push({ step: step, position: position });
        });
        document.getElementById("lesson").hidden = true;

        const panel = document.getElementById("explanation");
        if (allSteps.length === 0) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        renderStory();
    };

    // ---- the story: what happened to the text, one operation at a time ----

    function storyBox(label, text, highlightRe) {
        const col = el("div", "io-col");
        col.appendChild(el("small", "io-label", label));
        const shown = shortText(text, 140);
        const box = el("div", "io-box");
        if (highlightRe) box.appendChild(marked(shown, highlightRe));
        else box.appendChild(el("code", null, shown === "" ? "(empty text)" : shown));
        col.appendChild(box);
        const count = Array.from(text).length;
        col.appendChild(el("small", "io-meta", count + (count === 1 ? " character" : " characters")));
        return col;
    }

    const URL_TOKENS = /(%[0-9A-Fa-f]{2}|\+)/;
    const B64_PADDING = /(=+)$/;

    function storyOp(step, position) {
        const info = PLAIN[step.name] || { icon: "\u2699\uFE0F", title: step.name, text: "Transforms the text it receives." };
        const card = el("div", "story-card");

        card.appendChild(put(el("div", "story-head"),
            el("span", "story-num", String(position + 1)),
            el("span", "story-icon", info.icon),
            el("b", null, info.title)));
        card.appendChild(el("p", "story-text", info.text));

        const beforeRe = step.name === "urlDecode" ? URL_TOKENS : step.name === "fromBase64" ? B64_PADDING : null;
        const afterRe = step.name === "urlEncode" ? URL_TOKENS : step.name === "toBase64" ? B64_PADDING : null;
        card.appendChild(put(el("div", "story-io"),
            storyBox("Before", step.input, beforeRe),
            el("span", "io-arrow", "\u2192"),
            storyBox(position === allSteps.length - 1 ? "After (final result)" : "After", step.output, afterRe)));

        const tabPosition = tabs.findIndex(function (t) { return t.position === position; });
        if (tabPosition >= 0) {
            card.appendChild(makeButton("Show me how it works \u2192", null,
                function () { openLesson(tabPosition); }, "story-btn"));
        }
        return card;
    }

    function pipeChip(icon, text) {
        return put(el("span", "pipe-chip"), el("span", "pipe-icon", icon), document.createTextNode(text));
    }

    function renderStory() {
        const box = document.getElementById("recipe-story");
        box.replaceChildren();
        box.appendChild(el("h3", "story-title", "What just happened to your text?"));
        box.appendChild(el("p", "story-sub", allSteps.length === 1
            ? "Here is what your operation did, in plain words."
            : "Your recipe ran " + allSteps.length + " operations, one after another. The result of each one is handed to the next."));

        const pipe = el("div", "pipeline");
        pipe.appendChild(pipeChip("\u270D\uFE0F", "Your text"));
        allSteps.forEach(function (step) {
            const info = PLAIN[step.name] || { icon: "\u2699\uFE0F", title: step.name };
            pipe.appendChild(el("span", "pipe-arrow", "\u2192"));
            pipe.appendChild(pipeChip(info.icon, info.title));
        });
        pipe.appendChild(el("span", "pipe-arrow", "\u2192"));
        pipe.appendChild(pipeChip("\uD83C\uDFAF", "Result"));
        box.appendChild(pipe);

        const flow = el("div", "story-flow");
        flow.appendChild(put(el("div", "story-start"),
            el("div", "story-start-label", "\u270D\uFE0F  You started with"),
            storyBox("Your text", allSteps[0].input, null)));
        allSteps.forEach(function (step, position) {
            flow.appendChild(el("div", "story-arrow", "\u2193"));
            flow.appendChild(storyOp(step, position));
        });
        box.appendChild(flow);
    }

    // ---- the lesson: a guided walkthrough of one operation ----

    function syncModeButton() {
        const hasMath = tabs[tabIndex].step.details.some(function (d) {
            return d.data.techOnly || d.data.rounds || d.data.words;
        });
        modeButton.hidden = !hasMath;
        modeButton.textContent = simple ? "Show the math" : "Back to simple view";
    }

    function openLesson(tabPosition) {
        tabIndex = tabPosition;
        cardIndex = 0;
        const lesson = document.getElementById("lesson");
        lesson.hidden = false;
        const step = tabs[tabIndex].step;
        const info = PLAIN[step.name];
        document.getElementById("lesson-title").textContent =
            (info ? info.icon + "  " : "") + "Inside " + (info ? info.title : step.name);
        syncModeButton();
        renderCard();
        lesson.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderCard() {
        stopTimer();
        const step = tabs[tabIndex].step;
        const cards = lessonCards();
        const detail = cards[cardIndex];
        const data = detail.data;
        const body = document.getElementById("explanation-body");
        body.replaceChildren();

        const stepNumberAt = function (i) {
            return cards.slice(0, i + 1).filter(function (c) { return !c.data.intro; }).length;
        };
        const stepTotal = cards.filter(function (c) { return !c.data.intro; }).length;

        // What this operation received (matters when steps are chained)
        put(body, put(el("p", "step-input"),
            el("span", "step-input-label", (PLAIN[step.name] ? PLAIN[step.name].title : step.name) + " received: "),
            el("code", null, shortText(step.input, 70) === "" ? "(empty text)" : shortText(step.input, 70))));

        // Stepper dots: a star for the warm-up, then 1, 2, 3...
        const stepper = el("div", "stepper");
        cards.forEach(function (c, i) {
            stepper.appendChild(makeButton(c.data.intro ? "\u2605" : String(stepNumberAt(i)), c.title,
                function () { goTo(i); },
                "dot" + (i === cardIndex ? " active" : (i < cardIndex ? " done" : ""))));
        });
        body.appendChild(stepper);

        body.appendChild(el("div", "card-kicker", data.intro ? "Warm-up" : "Step " + stepNumberAt(cardIndex) + " of " + stepTotal));
        body.appendChild(el("h3", "card-title", detail.title));

        if (data.plain) {
            // Plain words first; the technical text is tucked away unless "Show the math" is on
            body.appendChild(put(el("div", "callout"),
                el("div", "callout-label", "In simple words"),
                el("p", null, data.plain)));
            const tech = el("details", "tech");
            tech.open = !simple;
            tech.appendChild(el("summary", null, "Technical explanation"));
            tech.appendChild(el("p", null, detail.explanation));
            body.appendChild(tech);
        } else {
            body.appendChild(el("p", "card-explain", detail.explanation));
        }

        const visual = el("div", "visual");
        body.appendChild(visual);
        const ctx = { goTo: goTo, cardCount: cards.length, cards: cards, simple: simple };
        pickRenderer(data)(data, visual, ctx);

        document.getElementById("explain-progress").textContent =
            "Page " + (cardIndex + 1) + " of " + cards.length;
        document.getElementById("explain-prev").disabled = cardIndex === 0;
        document.getElementById("explain-next").disabled = cardIndex === cards.length - 1;
    }

    document.getElementById("explain-prev").onclick = function () { goTo(cardIndex - 1); };
    document.getElementById("explain-next").onclick = function () { goTo(cardIndex + 1); };

    const modeButton = document.getElementById("mode-toggle");
    modeButton.onclick = function () {
        const current = lessonCards()[cardIndex];
        simple = !simple;
        const cards = lessonCards();
        let index = cards.indexOf(current);
        if (index < 0) {
            // The card we were on is hidden in the simple view: go to the closest earlier one
            const all = tabs[tabIndex].step.details;
            let k = all.indexOf(current);
            while (k > 0 && cards.indexOf(all[k]) < 0) k--;
            index = Math.max(0, cards.indexOf(all[k]));
        }
        cardIndex = index;
        syncModeButton();
        renderCard();
    };
    document.getElementById("lesson-close").onclick = function () {
        stopTimer();
        document.getElementById("lesson").hidden = true;
    };

    const KINDS = {
        urlWhy: drawUrlWhy,
        pairs: drawPairs,
        pairsResult: drawPairsResult,
        rules: drawRules,
        b64Alphabet: drawB64Alphabet,
        b64Groups: drawB64Groups,
        b64Result: drawB64Result,
        rotWheel: drawRotWheel
    };

    // Decide how to draw a card from the keys in its data
    function pickRenderer(d) {
        if (d.kind && KINDS[d.kind]) return KINDS[d.kind];
        if (d.properties) return drawOverview;
        if (d.bytesHex) return drawBytes;
        if (d.paddedBytes !== undefined) return drawPadding;
        if (d.digest) return drawFinal;
        if (d.blocks) return drawBlocks;
        if (d.rounds) return drawRounds;
        if (d.words) return drawSchedule;
        if (d.diffMask) return drawAvalanche;
        return drawFallback;
    }

    function drawFallback(d, box) {
        box.appendChild(el("pre", "fallback", JSON.stringify(d, null, 2)));
    }

    // ======================================================================
    // Overview: what is a hash?
    // ======================================================================

    function drawOverview(d, box, ctx) {
        // The big picture: any input -> SHA-256 -> always 256 bits
        const pic = el("div", "ov-pic");
        const inputs = el("div", "ov-inputs");
        ["hi", "Hello, world!", "a whole book\u2026"].forEach(function (s) {
            inputs.appendChild(el("div", "ov-pill", s));
        });
        const machine = put(el("div", "ov-machine"),
            el("b", null, "SHA-256"),
            el("small", null, "mixes the bits again and again"));
        const out = el("div", "ov-out");
        for (let i = 0; i < 8; i++) out.appendChild(el("span", "ov-chip h" + i, "32 bits"));
        put(pic,
            put(el("div", "ov-col"), el("div", "ov-caption", "any size in"), inputs),
            el("div", "ov-arrow", "\u2192"),
            machine,
            el("div", "ov-arrow", "\u2192"),
            put(el("div", "ov-col"), el("div", "ov-caption", "always 256 bits out"), out));
        box.appendChild(pic);

        // The five properties
        const icons = {
            "Deterministic": "\uD83D\uDD01",
            "Fixed size": "\uD83D\uDCCF",
            "One-way": "\uD83D\uDEAA",
            "Avalanche effect": "\uD83C\uDF0A",
            "Collision resistant": "\uD83D\uDEE1\uFE0F"
        };
        const props = el("div", "prop-grid");
        d.properties.forEach(function (p) {
            put(props, put(el("div", "prop-card"),
                el("div", "prop-icon", icons[p.name] || "\u2728"),
                el("b", null, p.name),
                el("p", null, p.text)));
        });
        box.appendChild(props);

        // Roadmap you can click (built from the cards that are actually shown)
        const roadmap = section("The journey of your text", "Click a stage to jump to it, or use Next.");
        const flow = el("div", "flow");
        ctx.cards.forEach(function (card, i) {
            if (i === 0) return;
            if (flow.children.length > 0) flow.appendChild(el("span", "flow-arrow", "\u2192"));
            flow.appendChild(makeButton(i + ". " + card.title, null,
                function () { ctx.goTo(i); }, "flow-step"));
        });
        roadmap.appendChild(flow);
        box.appendChild(roadmap);
    }

    // ======================================================================
    // Step 1: text -> bytes
    // ======================================================================

    function drawBytes(d, box) {
        if (d.byteCount === 0) {
            box.appendChild(el("p", "note",
                "The input is empty, so there are zero bytes. SHA-256 can still hash it, because the padding in the next step supplies the content."));
            return;
        }

        // Group bytes by character (a character can be 1 to 4 bytes in UTF-8)
        const encoder = new TextEncoder();
        const groups = [];
        let used = 0;
        for (const character of Array.from(d.text)) {
            if (used >= d.bytesHex.length) break;
            const len = encoder.encode(character).length;
            groups.push({ ch: character, from: used, to: Math.min(used + len, d.bytesHex.length) });
            used += len;
        }

        const names = { " ": "\u2423", "\n": "\u21B5", "\t": "\u21E5" };
        const row = el("div", "char-row");
        groups.forEach(function (g) {
            const group = el("div", "char-group");
            put(group,
                el("div", "char-label", names[g.ch] || g.ch),
                el("div", "char-sub", g.to - g.from > 1 ? (g.to - g.from) + " bytes" : "1 byte"));
            const bytes = el("div", "byte-row");
            for (let i = g.from; i < g.to; i++) {
                const hex = d.bytesHex[i];
                const bits = d.bytesBinary[i];
                const tile = el("div", "byte-tile");
                put(tile, el("div", "byte-dec", String(parseInt(hex, 16))), el("div", "byte-hex", hex));
                const cells = el("div", "byte-bits");
                for (const bit of bits) cells.appendChild(el("span", "bit " + (bit === "1" ? "on" : "off")));
                tile.appendChild(cells);
                bytes.appendChild(tile);
            }
            group.appendChild(bytes);
            row.appendChild(group);
        });
        box.appendChild(row);

        const legend = el("div", "legend");
        put(legend,
            el("span", null, "Each tile: decimal value, hex value, then the 8 bits (filled = 1)."),
            el("span", null, d.byteCount + " bytes = " + (d.byteCount * 8) + " bits"));
        box.appendChild(legend);
        if (d.truncated) {
            box.appendChild(el("p", "note", "Showing the first " + d.bytesHex.length + " of " + d.byteCount + " bytes."));
        }
    }

    // ======================================================================
    // Step 2: padding
    // ======================================================================

    function drawPadding(d, box) {
        const n = d.messageBytes;
        const total = d.paddedBytes;
        const zeroBits = d.paddedBits - 65 - d.originalBits;

        function chip(cls, big, small) {
            return put(el("div", "pad-chip " + cls), el("b", null, big), el("small", null, small));
        }
        const blocksWord = (total / 64) + (total === 64 ? " block" : " blocks");
        box.appendChild(put(el("div", "pad-eq"),
            chip("msg", d.originalBits + " bits", "your message"), opSign("+"),
            chip("one", "1 bit", "the marker 1"), opSign("+"),
            chip("zero", zeroBits + " bits", "zeros"), opSign("+"),
            chip("len", "64 bits", "message length"), opSign("="),
            chip("total", d.paddedBits + " bits", blocksWord)));

        const hexes = chunk(d.truncated ? d.tailHex : d.paddedHex, 2);
        const start = d.truncated ? total - 64 : 0;
        const kindOf = function (i) {
            if (i < n) return "msg";
            if (i === n) return "one";
            if (i >= total - 8) return "len";
            return "zero";
        };
        const kindName = { msg: "message byte", one: "0x80 = the 1 bit followed by 7 zero bits", zero: "zero padding", len: "length field" };

        const blockCount = hexes.length / 64;
        for (let b = 0; b < blockCount; b++) {
            const wrap = el("div", "pad-block");
            wrap.appendChild(el("div", "pad-block-title",
                d.truncated ? "Last block (block " + (total / 64) + ", earlier blocks hidden)"
                    : "Block " + (b + 1) + " of " + blockCount + "  \u2022  64 bytes = 512 bits"));
            const grid = el("div", "byte-grid");
            hexes.slice(b * 64, (b + 1) * 64).forEach(function (h, i) {
                const globalIndex = start + b * 64 + i;
                const kind = kindOf(globalIndex);
                const cell = el("div", "bcell " + kind, h);
                cell.title = "byte " + globalIndex + ": " + kindName[kind];
                grid.appendChild(cell);
            });
            wrap.appendChild(grid);
            box.appendChild(wrap);
        }

        const legend = el("div", "legend");
        [["msg", "your message"], ["one", "0x80 marker"], ["zero", "zero padding"], ["len", "length (" + d.lengthHex + ")"]]
            .forEach(function (item) {
                put(legend, put(el("span", "legend-item"), el("i", "swatch " + item[0]), document.createTextNode(item[1])));
            });
        box.appendChild(legend);

        if (n % 64 > 55) {
            box.appendChild(el("p", "note",
                "This message leaves fewer than 9 free bytes in its last block, so the marker and length did not fit and an extra block was added."));
        }
    }

    // ======================================================================
    // Step 3: blocks and words
    // ======================================================================

    function wordTile(label, value, cls) {
        return put(el("div", "word-tile " + (cls || "")),
            el("small", "word-name", label),
            el("b", "word-hex", value));
    }

    function drawBlocks(d, box) {
        d.blocks.forEach(function (words, b) {
            const card = el("div", "block-card");
            card.appendChild(el("div", "pad-block-title",
                "Block " + (b + 1) + " of " + d.totalBlocks + "  \u2022  512 bits = 16 words \u00D7 32 bits"));
            const grid = el("div", "word-grid cols8");
            words.forEach(function (w, i) { grid.appendChild(wordTile("W" + i, w, "w-input")); });
            card.appendChild(grid);
            box.appendChild(card);
            if (b < d.blocks.length - 1) {
                box.appendChild(el("div", "chain", "\u2193 the hash state after block " + (b + 1) + " is the starting state for block " + (b + 2)));
            }
        });
        if (d.truncated) {
            box.appendChild(el("p", "note", "Showing the first " + d.blocks.length + " of " + d.totalBlocks + " blocks."));
        }
    }

    // ======================================================================
    // Step 4: message schedule (16 words -> 64 words)
    // ======================================================================

    function mixDiagram(title, x, ops, result) {
        const wrap = el("div", "mix");
        wrap.appendChild(el("h5", "mix-title", title));
        wrap.appendChild(bitLine("input", x));
        ops.forEach(function (o) { wrap.appendChild(bitLine(o.label, o.fn(x), null, "op")); });
        wrap.appendChild(bitLine("XOR =", result, null, "result"));
        return wrap;
    }

    function drawSchedule(d, box, ctx) {
        const w = d.words.map(toInt);

        box.appendChild(put(el("div", "legend"),
            put(el("span", "legend-item"), el("i", "swatch msg"), document.createTextNode("W0\u2013W15: copied from the block")),
            put(el("span", "legend-item"), el("i", "swatch derived"), document.createTextNode("W16\u2013W63: calculated (click one!)"))));

        const grid = el("div", "word-grid cols8");
        const tiles = w.map(function (v, t) {
            const tile = wordTile("W" + t, hex8(v), t < 16 ? "w-input" : "w-derived");
            tile.onclick = function () { select(t); };
            grid.appendChild(tile);
            return tile;
        });
        box.appendChild(grid);

        const detail = el("div", "sched-detail");
        box.appendChild(detail);

        function select(t) {
            tiles.forEach(function (tile) { tile.classList.remove("sel", "src1", "src2", "src3", "src4"); });
            detail.replaceChildren();

            if (t < 16) {
                detail.appendChild(el("p", "note", "W" + t + " comes straight from the message block. Click a pink word (W16 to W63) to see how it is calculated."));
                tiles[t].classList.add("sel");
                return;
            }

            const a = w[t - 16];
            const b = sig0(w[t - 15]);
            const c = w[t - 7];
            const e = sig1(w[t - 2]);
            const sum = add32(a, b, c, e);

            tiles[t].classList.add("sel");
            tiles[t - 16].classList.add("src1");
            tiles[t - 15].classList.add("src2");
            tiles[t - 7].classList.add("src3");
            tiles[t - 2].classList.add("src4");

            if (ctx.simple) {
                detail.appendChild(el("p", "vis-sub",
                    "W" + t + " is a blend of the four outlined pieces: W" + (t - 16) + ", W" + (t - 15) + ", W" + (t - 7) +
                    " and W" + (t - 2) + ". Click other pink pieces to see which earlier pieces they are blended from. (Choose \"Show the math\" to see exactly how.)"));
                return;
            }

            detail.appendChild(el("h4", "vis-title", "How W" + t + " is built"));
            detail.appendChild(put(el("div", "equation"),
                term("W" + t, sum, "res"), opSign("="),
                term("W" + (t - 16), a, "t1"), opSign("+"),
                term("\u03C30(W" + (t - 15) + ")", b, "t2"), opSign("+"),
                term("W" + (t - 7), c, "t3"), opSign("+"),
                term("\u03C31(W" + (t - 2) + ")", e, "t4")));
            detail.appendChild(el("p", "vis-sub",
                "All additions wrap around at 32 bits (mod 2\u00B3\u00B2). " +
                (sum === w[t] ? "\u2713 Calculated in your browser and it matches the server." : "\u26A0 Does not match the server value!")));

            detail.appendChild(put(el("div", "mix-row"),
                mixDiagram("\u03C30 mixes W" + (t - 15), w[t - 15],
                    [{ label: "ROTR 7", fn: (v) => rotr(v, 7) }, { label: "ROTR 18", fn: (v) => rotr(v, 18) }, { label: "SHR 3", fn: (v) => v >>> 3 }],
                    b),
                mixDiagram("\u03C31 mixes W" + (t - 2), w[t - 2],
                    [{ label: "ROTR 17", fn: (v) => rotr(v, 17) }, { label: "ROTR 19", fn: (v) => rotr(v, 19) }, { label: "SHR 10", fn: (v) => v >>> 10 }],
                    e)));
            detail.appendChild(el("p", "vis-sub",
                "ROTR = rotate bits right (bits that fall off the end come back at the start). SHR = shift right (bits fall off, zeros come in). XOR = 1 where an odd number of the rows have a 1."));
        }
        // Start on a word whose two sigma inputs are both non-zero, so every picture has something to show
        let first = 16;
        for (let t = 16; t < 64; t++) {
            if (w[t - 15] !== 0 && w[t - 2] !== 0) { first = t; break; }
        }
        select(first);
    }

    // ======================================================================
    // Step 5: the 64 rounds
    // ======================================================================

    const REG = ["a", "b", "c", "d", "e", "f", "g", "h"];

    function regRow(values, notes, highlight) {
        const row = el("div", "reg-row");
        values.forEach(function (v, i) {
            const box = el("div", "reg" + (highlight && highlight.indexOf(i) >= 0 ? " new" : ""));
            put(box,
                el("span", "reg-name", REG[i]),
                el("span", "reg-val", hex8(v)),
                el("span", "reg-note", notes[i] || ""));
            row.appendChild(box);
        });
        return row;
    }

    function drawRounds(d, box, ctx) {
        const simpleView = ctx.simple;
        const init = d.initialState.map(toInt);
        const rounds = d.rounds;
        let t = 0;

        const prev = makeButton("\u25C0", "Previous round", function () { stop(); t--; render(); }, "ctl");
        const next = makeButton("\u25B6", "Next round", function () { stop(); t++; render(); }, "ctl");
        const play = makeButton("\u25B6 Play", "Animate all 64 rounds", onPlay, "ctl play");
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = 0;
        slider.max = rounds.length - 1;
        slider.value = 0;
        slider.oninput = function () { stop(); t = Number(slider.value); render(); };
        const label = el("span", "round-label");
        put(box, put(el("div", "round-controls"), prev, slider, next, play, label));

        const strip = el("div", "round-strip");
        const cells = rounds.map(function (_, i) {
            const c = makeButton("", "Round " + (i + 1), function () { stop(); t = i; render(); }, "round-cell");
            strip.appendChild(c);
            return c;
        });
        box.appendChild(strip);

        const view = el("div", "round-view");
        box.appendChild(view);

        function stop() {
            stopTimer();
            play.textContent = "\u25B6 Play";
        }

        function onPlay() {
            if (timer) { stop(); return; }
            if (t >= rounds.length - 1) { t = 0; render(); }
            play.textContent = "\u275A\u275A Pause";
            timer = setInterval(function () {
                if (t >= rounds.length - 1) { stop(); return; }
                t++;
                render();
            }, 800);
        }

        function render() {
            const before = t === 0 ? init : rounds[t - 1].state.map(toInt);
            const r = rounds[t];
            const after = r.state.map(toInt);
            const a = before[0], b = before[1], c = before[2], dd = before[3];
            const e = before[4], f = before[5], g = before[6], h = before[7];
            const K = toInt(r.k), W = toInt(r.w);

            const s1 = SIG1(e), chv = ch(e, f, g), s0 = SIG0(a), mj = maj(a, b, c);
            const T1 = add32(h, s1, chv, K, W);
            const T2 = add32(s0, mj);
            const ok = T1 === toInt(r.t1) && T2 === toInt(r.t2) &&
                after[0] === add32(T1, T2) && after[4] === add32(dd, T1);

            slider.value = t;
            label.textContent = "Round " + (t + 1) + " of " + rounds.length;
            prev.disabled = t === 0;
            next.disabled = t === rounds.length - 1;
            cells.forEach(function (cell, i) {
                cell.className = "round-cell" + (i < t ? " done" : "") + (i === t ? " current" : "");
            });

            view.replaceChildren();

            if (simpleView) {
                // Learner view: just the 8 mixed numbers, and the same numbers as a bit pattern
                const sa = section("The 8 mixed numbers after round " + (t + 1),
                    "Think of 8 cups of paint. Each round pours in a little of your text and swaps colours between the cups. "
                    + "The two highlighted cups got a brand-new mix; the others just moved over one place.");
                sa.appendChild(regRow(after, ["new mix", "moved over", "moved over", "moved over",
                    "new mix", "moved over", "moved over", "moved over"], [0, 4]));
                view.appendChild(sa);

                const sb = section("The same 8 numbers as bits",
                    "A computer sees each number as 32 on/off squares. Press Play and watch the pattern get shuffled again and again.");
                after.forEach(function (value, i) { sb.appendChild(bitLine(REG[i], value)); });
                view.appendChild(sb);
                return;
            }

            // Before
            const s1sec = section(simpleView ? "Before this round" : "1. Where this round starts",
                simpleView
                    ? (t === 0 ? "The 8 cups start with their fixed starting colours." : "These 8 numbers came out of the previous round.")
                    : (t === 0 ? "Round 1 begins with the starting hash state (the constants H0 to H7)."
                        : "These eight values are the result of the previous round."));
            s1sec.appendChild(regRow(before, simpleView
                ? ["moves over", "moves over", "moves over", "gets mixed in", "moves over", "moves over", "moves over", "drops out"]
                : ["moves to b", "moves to c", "moves to d", "+ T1 \u2192 new e",
                    "moves to f", "moves to g", "moves to h", "used in T1, then dropped"]));
            view.appendChild(s1sec);

            if (!simpleView) {
                // T1 and T2
                const s2 = section("2. Mix them into two temporary values",
                    "K[t] is a fixed constant for this round and W[t] is the matching word from the message schedule.");
                s2.appendChild(put(el("div", "equation"),
                    term("T1", T1, "res"), opSign("="),
                    term("h", h, "t1"), opSign("+"),
                    term("\u03A31(e)", s1, "t2"), opSign("+"),
                    term("Ch(e,f,g)", chv, "t3"), opSign("+"),
                    term("K[" + t + "]", K, "t4"), opSign("+"),
                    term("W[" + t + "]", W, "t5")));
                s2.appendChild(put(el("div", "equation"),
                    term("T2", T2, "res"), opSign("="),
                    term("\u03A30(a)", s0, "t2"), opSign("+"),
                    term("Maj(a,b,c)", mj, "t3")));
                s2.appendChild(el("p", "vis-sub", "All additions wrap around at 32 bits (mod 2\u00B3\u00B2)."));
                view.appendChild(s2);

                // Ch and Maj at bit level
                const s3 = section("3. Two bit-by-bit decisions: Ch and Maj",
                    "Ch (choose): wherever e has a 1, copy the bit from f; wherever e has a 0, copy it from g. Maj (majority): each result bit is whatever at least two of a, b, c have.");
                const eb = bin32(e);
                const ab = bin32(a), bb = bin32(b), cb = bin32(c), mb = bin32(mj);
                const chBox = el("div", "mix");
                put(chBox,
                    el("h5", "mix-title", "Ch(e, f, g)"),
                    bitLine("e (picker)", e),
                    bitLine("f", f, function (i) { return eb[i] === "1" ? "pickf" : "dim"; }),
                    bitLine("g", g, function (i) { return eb[i] === "0" ? "pickg" : "dim"; }),
                    bitLine("Ch", chv, function (i) { return eb[i] === "1" ? "fromf" : "fromg"; }, "result"));
                const majBox = el("div", "mix");
                const agree = function (own) { return function (i) { return own[i] === mb[i] ? "agree" : "dim"; }; };
                put(majBox,
                    el("h5", "mix-title", "Maj(a, b, c)"),
                    bitLine("a", a, agree(ab)),
                    bitLine("b", b, agree(bb)),
                    bitLine("c", c, agree(cb)),
                    bitLine("Maj", mj, null, "result"));
                s3.appendChild(put(el("div", "mix-row"), chBox, majBox));
                s3.appendChild(put(el("div", "legend"),
                    put(el("span", "legend-item"), el("i", "swatch pickf"), document.createTextNode("copied from f")),
                    put(el("span", "legend-item"), el("i", "swatch pickg"), document.createTextNode("copied from g")),
                    put(el("span", "legend-item"), el("i", "swatch agree"), document.createTextNode("agrees with the majority"))));
                view.appendChild(s3);
            }

            // After
            const s4 = section(simpleView ? "After this round" : "4. Shift everything along",
                simpleView
                    ? "The round mixed new data into two of the cups (a and e, highlighted). The other cups just moved over by one place, and the last one dropped out."
                    : "a becomes T1 + T2, e becomes d + T1, and every other variable moves one place to the right. h falls out.");
            s4.appendChild(regRow(after, simpleView
                ? ["new mix", "moved from a", "moved from b", "moved from c", "new mix", "moved from e", "moved from f", "moved from g"]
                : ["T1 + T2 (new)", "old a", "old b", "old c", "old d + T1 (new)", "old e", "old f", "old g"], [0, 4]));
            view.appendChild(s4);

            if (!simpleView) {
                view.appendChild(el("p", "verify " + (ok ? "ok" : "bad"),
                    ok ? "\u2713 Every value above was recomputed in your browser and matches the server."
                        : "\u26A0 A value did not match the server."));
            }
        }

        render();
    }

    // ======================================================================
    // Step 6: final hash
    // ======================================================================

    function drawFinal(d, box, ctx) {
        if (!ctx.simple) {
            d.blocks.forEach(function (entry) {
                const card = el("div", "block-card");
                card.appendChild(el("div", "pad-block-title",
                    "Block " + entry.block + " of " + d.totalBlocks + ": add the result of the 64 rounds back into the state"));

                const table = el("table", "final-table");
                const head = el("tr");
                head.appendChild(el("th", null, ""));
                for (let i = 0; i < 8; i++) head.appendChild(el("th", "h" + i, "H" + i));
                table.appendChild(head);

                let allOk = true;
                [["State before", entry.before, false], ["+ a to h after 64 rounds", entry.working, false], ["= New state", entry.after, true]]
                    .forEach(function (rowDef) {
                        const tr = el("tr", rowDef[2] ? "sum" : "");
                        tr.appendChild(el("th", "rowlabel", rowDef[0]));
                        rowDef[1].forEach(function (value, i) {
                            tr.appendChild(el("td", rowDef[2] ? "h" + i : "", value));
                        });
                        table.appendChild(tr);
                    });
                entry.before.forEach(function (v, i) {
                    if (add32(toInt(v), toInt(entry.working[i])) !== toInt(entry.after[i])) allOk = false;
                });
                card.appendChild(put(el("div", "table-scroll"), table));
                card.appendChild(el("p", "verify " + (allOk ? "ok" : "bad"),
                    allOk ? "\u2713 Each column was added (mod 2\u00B3\u00B2) in your browser and matches the server."
                        : "\u26A0 A column did not match."));
                box.appendChild(card);
            });
            if (d.totalBlocks > d.blocks.length) {
                box.appendChild(el("p", "note", "Showing the first " + d.blocks.length + " of " + d.totalBlocks + " blocks."));
            }
        }

        const result = section("The 256-bit hash",
            ctx.simple ? "The 8 mixed numbers, written side by side, are the hash of your text."
                : "The eight final words, joined in order, are the hash.");
        const digest = el("div", "digest");
        chunk(d.digest, 8).forEach(function (word, i) {
            digest.appendChild(el("span", "dig-word h" + i, word));
        });
        result.appendChild(digest);
        result.appendChild(el("p", "verify " + (d.matchesJdk ? "ok" : "bad"),
            d.matchesJdk ? "\u2713 Identical to the result from Java's built-in SHA-256."
                : "\u26A0 Different from Java's built-in SHA-256."));
        box.appendChild(result);
    }

    // ======================================================================
    // Step 7: avalanche effect
    // ======================================================================

    function drawAvalanche(d, box) {
        const SHOW = 40;
        const orig = Array.from(d.originalText);
        const chng = Array.from(d.changedText);
        const offset = Math.max(orig.length, chng.length) > SHOW ? Math.max(orig.length, chng.length) - SHOW : 0;

        function textLine(label, chars, other) {
            const line = el("div", "av-line");
            line.appendChild(el("span", "av-label", label));
            const text = el("span", "av-text");
            if (offset > 0) text.appendChild(el("span", "av-dots", "\u2026"));
            chars.slice(offset).forEach(function (c, i) {
                const differs = other[offset + i] !== c;
                text.appendChild(el("span", "av-char" + (differs ? " changed" : ""), c === " " ? "\u2423" : c));
            });
            line.appendChild(text);
            return line;
        }
        box.appendChild(put(el("div", "av-box"),
            textLine("original", orig, chng),
            textLine("one bit flipped", chng, orig)));

        function hashLine(label, hash, other) {
            const line = el("div", "av-line");
            line.appendChild(el("span", "av-label", label));
            const text = el("span", "av-hash");
            hash.split("").forEach(function (c, i) {
                text.appendChild(el("span", "av-hc" + (c !== other[i] ? " changed" : ""), c));
            });
            line.appendChild(text);
            return line;
        }
        box.appendChild(put(el("div", "av-box"),
            hashLine("original hash", d.originalHash, d.changedHash),
            hashLine("new hash", d.changedHash, d.originalHash)));

        const pct = Math.round((d.diffBits / d.totalBits) * 1000) / 10;
        box.appendChild(el("p", "av-stat", d.diffBits + " of " + d.totalBits + " output bits changed (" + pct + "%)"));
        box.appendChild(put(el("div", "av-meter"),
            put(el("div", "av-meter-fill"))));
        box.querySelector(".av-meter-fill").style.width = pct + "%";

        const grid = el("div", "av-grid");
        d.diffMask.split("").forEach(function (bit, i) {
            const cell = el("span", "av-cell " + (bit === "1" ? "flip" : "same"));
            cell.title = "output bit " + i + (bit === "1" ? ": changed" : ": same");
            grid.appendChild(cell);
        });
        box.appendChild(grid);
        box.appendChild(put(el("div", "legend"),
            put(el("span", "legend-item"), el("i", "swatch flip"), document.createTextNode("bit changed")),
            put(el("span", "legend-item"), el("i", "swatch same"), document.createTextNode("bit stayed the same")),
            el("span", null, "A good hash lands close to 50%.")));
    }
    // ======================================================================
    // URL encoding visuals
    // ======================================================================

    function legendItem(cls, text) {
        return put(el("span", "legend-item"), el("i", "swatch " + cls), document.createTextNode(text));
    }

    function showChar(ch) {
        return ch === " " ? "\u2423" : ch;
    }

    function drawUrlWhy(d, box) {
        // An address has parts; some characters are the glue between them
        const parts = [
            ["https://", "protocol", "p1"], ["shop.com", "website", "p2"], ["/search", "page", "p3"],
            ["?", "options start", "glue"], ["q=fish", "an option", "p5"], ["&", "next option", "glue"], ["page=2", "another option", "p5"]
        ];
        const anat = el("div", "anat");
        parts.forEach(function (p) {
            anat.appendChild(put(el("div", "anat-part " + p[2]), el("code", null, p[0]), el("small", null, p[1])));
        });
        const s1 = section("A web address has a structure",
            "Characters like ? & = / : are the glue that holds its parts together.");
        s1.appendChild(anat);
        box.appendChild(s1);

        // The problem and the fix
        const s2 = section("The problem", "What if your own text contains one of those glue characters?");
        const bad = put(el("div", "url-case bad"),
            el("small", null, "Without encoding"),
            marked("shop.com/search?q=fish & chips", /(&)/),
            el("p", null, "The address reads: option q = \"fish \", then a new option called \"chips\". Your text got cut in half!"));
        const good = put(el("div", "url-case good"),
            el("small", null, "With URL encoding"),
            marked("shop.com/search?q=fish+%26+chips", /(%[0-9A-Fa-f]{2}|\+)/),
            el("p", null, "The address reads: option q = \"fish & chips\". The & is disguised as %26 and each space as +, so nothing is misread."));
        s2.appendChild(put(el("div", "url-cases"), bad, good));
        box.appendChild(s2);
    }

    // ======================================================================
    // Character-by-character cards (URL encode/decode, ROT13)
    // ======================================================================

    function drawPairs(d, box) {
        const legend = el("div", "legend");
        (d.legend || []).forEach(function (item) { legend.appendChild(legendItem("u-" + item.kind, item.text)); });
        box.appendChild(legend);

        const grid = el("div", "uchar-grid");
        const detail = el("div", "uchar-detail");
        const cards = d.chars.map(function (c, i) {
            const card = el("div", "uchar " + c.kind);
            put(card, el("div", "uc-ch", showChar(c.ch)), el("div", "uc-arrow", "\u2193"), el("div", "uc-out", showChar(c.out)));
            card.onclick = function () { select(i); };
            grid.appendChild(card);
            return card;
        });
        box.appendChild(grid);
        box.appendChild(detail);

        function select(i) {
            const c = d.chars[i];
            cards.forEach(function (card, k) { card.classList.toggle("sel", k === i); });
            detail.replaceChildren();
            detail.appendChild(el("h4", "vis-title",
                "\"" + showChar(c.ch) + "\" " + (c.kind === "kept" ? "stays" : "becomes") + " \"" + showChar(c.out) + "\""));
            detail.appendChild(el("p", "vis-sub", c.reason));
            if (c.hex) detail.appendChild(el("p", "vis-sub", "Its computer code (in hex): " + c.hex));
        }

        if (d.chars.length > 0) {
            // Start on the most interesting piece: a changed one, otherwise the first
            let start = d.chars.findIndex(function (c) { return c.kind === "encoded" || c.kind === "changed"; });
            if (start < 0) start = d.chars.findIndex(function (c) { return c.kind === "space"; });
            select(start >= 0 ? start : 0);
        }
        if (d.truncated) {
            box.appendChild(el("p", "note", "Showing the first " + d.chars.length + " of " + d.total + " characters."));
        }
    }

    function drawPairsResult(d, box) {
        function line(label, makePiece) {
            const text = el("span", "uline-text");
            d.chars.forEach(function (c) { text.appendChild(makePiece(c)); });
            return put(el("div", "uline"), el("span", "uline-label", label), text);
        }
        box.appendChild(put(el("div", "av-box"),
            line("Before", function (c) { return el("span", "uchip " + c.kind, showChar(c.ch)); }),
            line("After", function (c) { return el("span", "uchip " + c.kind, showChar(c.out)); })));

        const legend = el("div", "legend");
        (d.legend || []).forEach(function (item) { legend.appendChild(legendItem("u-" + item.kind, item.text)); });
        box.appendChild(legend);

        const counts = el("div", "pad-eq");
        (d.counts || []).forEach(function (c) {
            counts.appendChild(put(el("div", "pad-chip " + c.tone), el("b", null, String(c.value)), el("small", null, c.text)));
        });
        box.appendChild(counts);

        box.appendChild(el("p", "vis-sub", d.inputLength + " characters went in, " + d.outputLength + " came out."));
        if (d.check) {
            box.appendChild(el("p", "verify " + (d.check.ok ? "ok" : "bad"),
                (d.check.ok ? "\u2713 " : "\u26A0 Not true here: ") + d.check.text));
        }
        if (d.truncated) {
            box.appendChild(el("p", "note", "Showing the first " + d.chars.length + " of " + d.inputLength + " characters."));
        }
    }

    // ======================================================================
    // "Rules" card (URL decode warm-up)
    // ======================================================================

    function drawRules(d, box) {
        const grid = el("div", "rule-grid");
        d.rules.forEach(function (r) {
            grid.appendChild(put(el("div", "rule-card"),
                put(el("div", "rule-eq"),
                    el("code", "rule-from", r.from),
                    el("span", "rule-arrow", "\u2192"),
                    el("code", "rule-to", r.to)),
                el("p", null, r.text)));
        });
        box.appendChild(grid);
    }

    // ======================================================================
    // Base64
    // ======================================================================

    function drawB64Alphabet(d, box) {
        const grid = el("div", "b64-grid");
        d.alphabet.split("").forEach(function (ch, i) {
            const tone = i < 26 ? "t0" : i < 52 ? "t1" : i < 62 ? "t2" : "t3";
            grid.appendChild(put(el("div", "b64-cell " + tone),
                el("small", null, String(i)),
                el("b", null, ch)));
        });
        box.appendChild(grid);
        box.appendChild(put(el("div", "legend"),
            put(el("span", "legend-item"), el("i", "swatch b64t0"), document.createTextNode("A to Z (0 to 25)")),
            put(el("span", "legend-item"), el("i", "swatch b64t1"), document.createTextNode("a to z (26 to 51)")),
            put(el("span", "legend-item"), el("i", "swatch b64t2"), document.createTextNode("0 to 9 (52 to 61)")),
            put(el("span", "legend-item"), el("i", "swatch b64t3"), document.createTextNode("+ and / (62, 63)"))));
        box.appendChild(el("p", "note",
            "Why 64? Six bits can make exactly 64 different numbers (0 to 63). That is why Base64 always works with pieces of 6 bits."));
    }

    /** A strip of little squares: groupSize bits per colour group; bits past `realBits` are dimmed padding. */
    function bitStrip(bits, groupSize, realBits, colourOf) {
        const strip = el("div", "strip");
        bits.split("").forEach(function (bit, i) {
            let cls = "bit " + (bit === "1" ? "on" : "off") + " c" + colourOf(Math.floor(i / groupSize));
            if (i % groupSize === groupSize - 1 && i < bits.length - 1) cls += " gap";
            if (i >= realBits) cls += " pad";
            strip.appendChild(el("span", cls));
        });
        return strip;
    }

    function rowWith(label, content) {
        return put(el("div", "b64-row"), el("div", "b64-rowlabel", label), content);
    }

    function tiles(items, className) {
        const row = el("div", "b64-tiles");
        items.forEach(function (item) { row.appendChild(item); });
        if (className) row.classList.add(className);
        return row;
    }

    function drawB64Groups(d, box) {
        const encode = d.direction === "encode";

        d.groups.forEach(function (g, gi) {
            const card = el("div", "b64-group");
            const realBits = g.bytes.length * 8;
            const bits24 = g.pieces.join("");

            const letters = g.bytes.map(function (b) { return b.label; }).join("");
            card.appendChild(el("div", "pad-block-title",
                "Group " + (gi + 1) + (encode ? ": the letters \"" + letters + "\"" : ": the symbols \"" + g.symbols.join("") + "\"")));

            const byteTiles = function () {
                const items = g.bytes.map(function (b, i) {
                    return put(el("div", "b64-tile byte c" + i), el("b", null, b.label), el("small", null, b.hex));
                });
                for (let k = 0; k < g.missingBytes; k++) {
                    items.push(put(el("div", "b64-tile ghost"), el("b", null, "\u2205"), el("small", null, "nothing")));
                }
                return tiles(items);
            };
            const byteBits = function () {
                return bitStrip(bits24, 8, realBits, function (n) { return n; });
            };
            const pieceBits = function () {
                return bitStrip(bits24, 6, realBits, function (n) { return n; });
            };
            const numberTiles = function () {
                return tiles(g.indexes.map(function (n, i) {
                    return put(el("div", "b64-tile num c" + i + (n < 0 ? " ghost" : "")),
                        el("b", null, n < 0 ? "\u2013" : String(n)),
                        el("small", null, g.pieces[i]));
                }));
            };
            const symbolTiles = function () {
                return tiles(g.symbols.map(function (sym, i) {
                    return put(el("div", "b64-tile sym c" + i + (sym === "=" ? " ghost" : "")),
                        el("b", null, sym),
                        el("small", null, sym === "=" ? "padding" : "symbol"));
                }));
            };

            if (encode) {
                card.appendChild(rowWith("1. Your letters", byteTiles()));
                card.appendChild(rowWith("2. As 24 bits (3 groups of 8)", byteBits()));
                card.appendChild(rowWith("3. Regroup as 4 pieces of 6 bits", pieceBits()));
                card.appendChild(rowWith("4. Each piece is a number from 0 to 63", numberTiles()));
                card.appendChild(rowWith("5. Look the number up in the alphabet", symbolTiles()));
            } else {
                card.appendChild(rowWith("1. The symbols", symbolTiles()));
                card.appendChild(rowWith("2. Look up each symbol's number", numberTiles()));
                card.appendChild(rowWith("3. Write each number as 6 bits", pieceBits()));
                card.appendChild(rowWith("4. Regroup as 3 groups of 8 bits", byteBits()));
                card.appendChild(rowWith("5. Your original letters", byteTiles()));
            }
            box.appendChild(card);
        });

        if (d.truncated) {
            box.appendChild(el("p", "note", "Showing the first " + d.groups.length + " of " + d.totalGroups + " groups. The rest work exactly the same way."));
        }
        if (d.groups.length === 0) {
            box.appendChild(el("p", "note", "The text is empty, so there is nothing to convert."));
        }
    }

    function drawB64Result(d, box) {
        const encode = d.direction === "encode";
        box.appendChild(put(el("div", "story-io"),
            storyBox("Before", d.input, encode ? null : B64_PADDING),
            el("span", "io-arrow", "\u2192"),
            storyBox("After", d.output, encode ? B64_PADDING : null)));

        const chips = el("div", "pad-eq");
        const inWord = encode ? "bytes" : "symbols";
        const outWord = encode ? "symbols" : "bytes";
        chips.appendChild(put(el("div", "pad-chip msg"), el("b", null, String(d.inputCount)), el("small", null, inWord + " in")));
        chips.appendChild(opSign("\u2192"));
        chips.appendChild(put(el("div", "pad-chip len"), el("b", null, String(d.outputCount)), el("small", null, outWord + " out")));
        box.appendChild(chips);

        if (encode && d.inputCount > 0) {
            const growth = Math.round((d.outputCount / d.inputCount - 1) * 100);
            box.appendChild(el("p", "vis-sub", "Base64 text is about one third longer than the original (here " + growth + "% longer), because 3 letters become 4 symbols."));
        }
        if (d.padding > 0) {
            box.appendChild(el("p", "note", encode
                ? "Your text did not fill the last group of 3 letters, so " + d.padding + " \"=\" sign" + (d.padding > 1 ? "s were" : " was") + " added to show that."
                : "The " + d.padding + " \"=\" sign" + (d.padding > 1 ? "s" : "") + " at the end only meant the last group was short. They disappear when decoding."));
        }
    }

    // ======================================================================
    // ROT13
    // ======================================================================

    function drawRotWheel(d, box) {
        const letters = "abcdefghijklmnopqrstuvwxyz";
        const grid = el("div", "rot-grid");
        for (let i = 0; i < 26; i++) {
            const partner = letters[(i + 13) % 26];
            grid.appendChild(put(el("div", "rot-col " + (i < 13 ? "first" : "second")),
                el("small", null, String(i + 1)),
                el("b", null, letters[i]),
                el("span", "rot-arrow", "\u2193"),
                el("b", "rot-out", partner)));
        }
        box.appendChild(grid);
        box.appendChild(el("p", "note",
            "Capital letters work the same way (A becomes N). Numbers, spaces and symbols are not letters, so ROT13 ignores them."));
    }
})();