package com.bheerappa.dataforge.operations;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class Rot13Operation implements Operations {

    private static final int MAX_CHARS_SHOWN = 80;

    @Override
    public String getName() {
        return "rot13";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        StringBuilder result = new StringBuilder();
        for (char c : input.toCharArray()) {
            result.append(rotateChar(c));
        }
        return result.toString();
    }

    private char rotateChar(char c) {
        if (c >= 'a' && c <= 'z') return (char) ('a' + (c - 'a' + 13) % 26);
        if (c >= 'A' && c <= 'Z') return (char) ('A' + (c - 'A' + 13) % 26);
        return c;
    }

    @Override
    public List<StepDetail> explain(String input, Map<String, String> params) {
        List<Map<String, Object>> chars = new ArrayList<>();
        int letters = 0, others = 0;

        for (char c : input.toCharArray()) {
            char out = rotateChar(c);
            // every ASCII letter changes under ROT13, so out != c identifies letters exactly
            boolean isLetter = out != c;
            if (isLetter) letters++; else others++;

            if (chars.size() < MAX_CHARS_SHOWN) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("ch", String.valueOf(c));
                entry.put("kind", isLetter ? "changed" : "kept");
                entry.put("out", String.valueOf(out));
                entry.put("hex", "");
                entry.put("reason", reasonFor(c, out, isLetter));
                chars.add(entry);
            }
        }

        int total = input.length();
        String output = apply(input, params);
        boolean roundTrip = apply(output, params).equals(input);

        List<StepDetail> steps = new ArrayList<>();
        steps.add(StepDetail.of(
            "The idea: a rotating alphabet",
            "ROT13 is a Caesar cipher with a fixed shift of 13. Because the alphabet has 26 letters, applying it "
                + "twice returns the original text, so encoding and decoding are the same operation.",
            "kind", "rotWheel",
            "intro", true,
            "plain", "Imagine the alphabet written in a circle. ROT13 swaps every letter with the letter exactly 13 "
                + "places further round the circle. After z it wraps back to a. Since there are 26 letters, "
                + "going 13 places twice brings you right back where you started."
        ));
        steps.add(StepDetail.of(
            "Swap letter by letter",
            "Each ASCII letter is replaced by the letter 13 positions later, wrapping around after z. Case is kept. "
                + "Digits, spaces and symbols are left alone.",
            "kind", "pairs",
            "plain", "The computer goes through your text one character at a time. A letter is swapped for its "
                + "partner 13 places along. Anything that is not a letter (spaces, digits, punctuation) stays "
                + "exactly as it is. Click any character to see the sum.",
            "legend", StepDetail.legend("changed", "Letter: swapped", "kept", "Not a letter: stays the same"),
            "chars", chars,
            "total", total,
            "truncated", total > chars.size()
        ));
        steps.add(StepDetail.of(
            "Put it back together",
            "The per-character results are concatenated. Running ROT13 on the result restores the input.",
            "kind", "pairsResult",
            "plain", "Joining all the swapped characters gives your new text. And because ROT13 is its own "
                + "undo button, running it on the result gives your original text back.",
            "legend", StepDetail.legend("changed", "Letter: swapped", "kept", "Not a letter: stays the same"),
            "chars", chars,
            "counts", List.of(
                StepDetail.count(letters, "letters swapped", "len"),
                StepDetail.count(others, "characters left alone", "msg")),
            "inputLength", total,
            "outputLength", output.length(),
            "check", check(roundTrip, "Running ROT13 again on the result gives back exactly your original text."),
            "truncated", total > chars.size()
        ));
        return steps;
    }

    private static Map<String, Object> check(boolean ok, String text) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("ok", ok);
        c.put("text", text);
        return c;
    }

    private static String reasonFor(char c, char out, boolean isLetter) {
        if (!isLetter) {
            return "This is not a letter, so ROT13 leaves it exactly as it is.";
        }
        char base = Character.isUpperCase(c) ? 'A' : 'a';
        int position = c - base + 1;
        int sum = position + 13;
        String lead = "'" + c + "' is letter number " + position + " of the alphabet. " + position + " + 13 = " + sum;
        if (sum > 26) {
            return lead + ", which is past 26, so we wrap round: " + sum + " - 26 = " + (sum - 26)
                + ". Letter number " + (sum - 26) + " is '" + out + "'.";
        }
        return lead + ". Letter number " + sum + " is '" + out + "'.";
    }
}