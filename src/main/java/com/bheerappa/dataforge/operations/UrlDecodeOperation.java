package com.bheerappa.dataforge.operations;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class UrlDecodeOperation implements Operations {

    private static final int MAX_CHARS_SHOWN = 80;

    @Override
    public String getName() {
        return "urlDecode";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        return URLDecoder.decode(input, StandardCharsets.UTF_8);
    }

    @Override
    public List<StepDetail> explain(String input, Map<String, String> params) {
        List<Map<String, Object>> chars = new ArrayList<>();
        int kept = 0, decoded = 0, spaces = 0, total = 0;

        int i = 0;
        while (i < input.length()) {
            char c = input.charAt(i);
            String token;
            String out;
            String kind;
            String hex = "";
            String reason;

            if (c == '%' && isHexPair(input, i + 1)) {
                // One character can be written as several %XX codes (accents, symbols, emoji).
                int first = hexValue(input, i + 1);
                int wanted = utf8Length(first);
                byte[] bytes = new byte[wanted];
                int got = 0;
                int j = i;
                StringBuilder tokenText = new StringBuilder();
                StringBuilder hexText = new StringBuilder();
                while (got < wanted && j < input.length() && input.charAt(j) == '%' && isHexPair(input, j + 1)) {
                    bytes[got++] = (byte) hexValue(input, j + 1);
                    tokenText.append(input, j, j + 3);
                    if (hexText.length() > 0) hexText.append(' ');
                    hexText.append(input, j + 1, j + 3);
                    j += 3;
                }
                token = tokenText.toString();
                out = new String(bytes, 0, got, StandardCharsets.UTF_8);
                kind = "encoded";
                hex = hexText.toString().toLowerCase();
                reason = got > 1
                    ? "These " + got + " codes together stand for ONE character, '" + out + "'. Computers store "
                        + "accents, symbols and emoji as several bytes."
                    : "The code " + hex + " (in hex) stands for the character '" + out + "'. A % followed by two "
                        + "digits is a hidden character.";
                i = j;
                decoded++;
            } else if (c == '+') {
                token = "+";
                out = " ";
                kind = "space";
                reason = "In web addresses a + stands for a space, so it is turned back into a space.";
                i++;
                spaces++;
            } else {
                int codePoint = input.codePointAt(i);
                token = new String(Character.toChars(codePoint));
                out = token;
                kind = "kept";
                reason = "This is already a normal character, so it stays exactly as it is.";
                i += Character.charCount(codePoint);
                kept++;
            }

            total++;
            if (chars.size() < MAX_CHARS_SHOWN) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("ch", token);
                entry.put("kind", kind);
                entry.put("out", out);
                entry.put("hex", hex);
                entry.put("reason", reason);
                chars.add(entry);
            }
        }

        String output = apply(input, params);
        List<Map<String, String>> legend = StepDetail.legend(
            "kept", "Normal: stays the same",
            "encoded", "Hidden: turned back into its real character",
            "space", "+ : turned back into a space");

        List<StepDetail> steps = new ArrayList<>();
        steps.add(StepDetail.of(
            "How decoding works",
            "Percent-decoding replaces each %XX sequence with the byte it names, turns + into a space, and reads the "
                + "resulting bytes as UTF-8.",
            "kind", "rules",
            "intro", true,
            "plain", "Decoding is simply the undo button for URL encoding. The computer reads your text and "
                + "follows three small rules.",
            "rules", List.of(
                rule("%26", "&", "A % followed by two digits is a hidden character. Look up its code and write the real character."),
                rule("+", "\u2423", "A + stands for a space."),
                rule("a b 7 . -", "same", "Anything else is already a normal character, so it stays as it is."))
        ));
        steps.add(StepDetail.of(
            "Find the hidden characters",
            "The text is scanned left to right; %XX runs are grouped into UTF-8 characters.",
            "kind", "pairs",
            "plain", "The computer reads your text from left to right. Normal characters pass straight through. "
                + "Every % code and every + gets turned back into the real character. Click any piece to see why.",
            "legend", legend,
            "chars", chars,
            "total", total,
            "truncated", total > chars.size()
        ));
        steps.add(StepDetail.of(
            "Put it back together",
            "The decoded pieces are concatenated in order.",
            "kind", "pairsResult",
            "plain", "All the real characters are joined side by side, and you get the readable text again.",
            "legend", legend,
            "chars", chars,
            "counts", List.of(
                StepDetail.count(kept, "normal characters kept", "msg"),
                StepDetail.count(decoded, "% codes turned back", "len"),
                StepDetail.count(spaces, "+ turned into spaces", "one")),
            "inputLength", input.length(),
            "outputLength", output.length(),
            "truncated", total > chars.size()
        ));
        return steps;
    }

    private static Map<String, String> rule(String from, String to, String text) {
        Map<String, String> r = new LinkedHashMap<>();
        r.put("from", from);
        r.put("to", to);
        r.put("text", text);
        return r;
    }

    private static boolean isHexPair(String s, int at) {
        return at + 1 < s.length() && Character.digit(s.charAt(at), 16) >= 0 && Character.digit(s.charAt(at + 1), 16) >= 0;
    }

    private static int hexValue(String s, int at) {
        return Character.digit(s.charAt(at), 16) * 16 + Character.digit(s.charAt(at + 1), 16);
    }

    /** How many bytes the UTF-8 character starting with this byte uses. */
    private static int utf8Length(int firstByte) {
        if (firstByte < 0x80) return 1;
        if ((firstByte & 0xE0) == 0xC0) return 2;
        if ((firstByte & 0xF0) == 0xE0) return 3;
        if ((firstByte & 0xF8) == 0xF0) return 4;
        return 1;
    }
}