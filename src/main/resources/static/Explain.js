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

    let tabs = [];        // recipe steps that have an explanation
    let tabIndex = 0;
    let cardIndex = 0;
    let timer = null;     // used by the round-by-round animation

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function goTo(index) {
        const count = tabs[tabIndex].details.length;
        cardIndex = Math.max(0, Math.min(count - 1, index));
        renderCard();
    }

    /** Called by script.js after every Bake. */
    window.renderExplanation = function (steps) {
        stopTimer();
        tabs = (steps || []).filter(function (s) {
            return s.details && s.details.length > 0;
        });
        const panel = document.getElementById("explanation");
        if (tabs.length === 0) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        tabIndex = 0;
        cardIndex = 0;
        renderTabs();
        renderCard();
    };

    function renderTabs() {
        const bar = document.getElementById("explanation-tabs");
        bar.replaceChildren();
        if (tabs.length < 2) return;
        tabs.forEach(function (step, i) {
            const b = makeButton((i + 1) + ". " + step.name, "Explain this step", function () {
                tabIndex = i;
                cardIndex = 0;
                renderTabs();
                renderCard();
            }, "tab-btn" + (i === tabIndex ? " active" : ""));
            bar.appendChild(b);
        });
    }

    function renderCard() {
        stopTimer();
        const step = tabs[tabIndex];
        const details = step.details;
        const detail = details[cardIndex];
        const body = document.getElementById("explanation-body");
        body.replaceChildren();

        // What this operation received (matters when steps are chained)
        const shown = step.input.length > 70 ? step.input.slice(0, 70) + "\u2026" : step.input;
        put(body, put(el("p", "step-input"),
            el("span", "step-input-label", step.name + " received: "),
            el("code", null, shown === "" ? "(empty text)" : shown)));

        // Stepper dots
        const stepper = el("div", "stepper");
        details.forEach(function (d, i) {
            const dot = makeButton(String(i), d.title, function () { goTo(i); },
                "dot" + (i === cardIndex ? " active" : (i < cardIndex ? " done" : "")));
            stepper.appendChild(dot);
        });
        body.appendChild(stepper);

        put(body,
            el("h3", "card-title", detail.title),
            el("p", "card-explain", detail.explanation));

        const visual = el("div", "visual");
        body.appendChild(visual);
        const ctx = { goTo: goTo, cardCount: details.length };
        pickRenderer(detail.data)(detail.data, visual, ctx);

        document.getElementById("explain-progress").textContent =
            "Step " + (cardIndex + 1) + " of " + details.length;
        document.getElementById("explain-prev").disabled = cardIndex === 0;
        document.getElementById("explain-next").disabled = cardIndex === details.length - 1;
    }

    document.getElementById("explain-prev").onclick = function () { goTo(cardIndex - 1); };
    document.getElementById("explain-next").onclick = function () { goTo(cardIndex + 1); };

    // Decide how to draw a card from the keys in its data
    function pickRenderer(d) {
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

        // Roadmap you can click
        const roadmap = section("The journey of your text", "Click a stage to jump to it, or use Next.");
        const flow = el("div", "flow");
        [["Bytes", 1], ["Padding", 2], ["Blocks", 3], ["Schedule", 4], ["64 rounds", 5], ["Final hash", 6]]
            .forEach(function (stage, i) {
                if (stage[1] >= ctx.cardCount) return;
                if (flow.children.length > 0) flow.appendChild(el("span", "flow-arrow", "\u2192"));
                flow.appendChild(makeButton((i + 1) + ". " + stage[0], null,
                    function () { ctx.goTo(stage[1]); }, "flow-step"));
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

    function drawSchedule(d, box) {
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

    function drawRounds(d, box) {
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

            // 1. start
            const s1sec = section("1. Where this round starts",
                t === 0 ? "Round 1 begins with the starting hash state (the constants H0 to H7)."
                    : "These eight values are the result of the previous round.");
            s1sec.appendChild(regRow(before, [
                "moves to b", "moves to c", "moves to d", "+ T1 \u2192 new e",
                "moves to f", "moves to g", "moves to h", "used in T1, then dropped"]));
            view.appendChild(s1sec);

            // 2. T1 and T2
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

            // 3. Ch and Maj at bit level
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

            // 4. shift
            const s4 = section("4. Shift everything along",
                "a becomes T1 + T2, e becomes d + T1, and every other variable moves one place to the right. h falls out.");
            s4.appendChild(regRow(after, [
                "T1 + T2 (new)", "old a", "old b", "old c",
                "old d + T1 (new)", "old e", "old f", "old g"], [0, 4]));
            view.appendChild(s4);

            view.appendChild(el("p", "verify " + (ok ? "ok" : "bad"),
                ok ? "\u2713 Every value above was recomputed in your browser and matches the server."
                    : "\u26A0 A value did not match the server."));
        }

        render();
    }

    // ======================================================================
    // Step 6: final hash
    // ======================================================================

    function drawFinal(d, box) {
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

        const result = section("The 256-bit hash", "The eight final words, joined in order, are the hash.");
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
})();