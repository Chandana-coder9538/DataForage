package com.bheerappa.dataforge.operations;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One teaching card shown to the user, e.g. "Fill up the box" or "Check every character".
 *
 * title       - short heading (no step number; the page numbers the cards itself)
 * explanation - the technical explanation
 * data        - what the page draws: a "kind" that picks the picture, a "plain" sentence
 *               in everyday words, and the values for the picture
 */
public record StepDetail(String title, String explanation, Map<String, Object> data) {

    /** Builds a card. The last arguments are alternating key, value pairs for its data. */
    public static StepDetail of(String title, String explanation, Object... keysAndValues) {
        Map<String, Object> data = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            data.put((String) keysAndValues[i], keysAndValues[i + 1]);
        }
        return new StepDetail(title, explanation, data);
    }

    /** Legend entries for the character-by-character cards: alternating kind, text. */
    public static List<Map<String, String>> legend(String... kindsAndTexts) {
        List<Map<String, String>> items = new ArrayList<>();
        for (int i = 0; i < kindsAndTexts.length; i += 2) {
            Map<String, String> item = new LinkedHashMap<>();
            item.put("kind", kindsAndTexts[i]);
            item.put("text", kindsAndTexts[i + 1]);
            items.add(item);
        }
        return items;
    }

    /** One number chip for result cards: tone picks the colour (msg, len or one). */
    public static Map<String, Object> count(int value, String text, String tone) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("value", value);
        item.put("text", text);
        item.put("tone", tone);
        return item;
    }
}