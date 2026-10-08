package com.bheerappa.dataforge.operations;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class UrlEncodeOperation implements Operations {

    // Keep responses small even for very long text.
    private static final int MAX_CHARS_SHOWN = 80;

    // Why some well-known characters can't be used as plain text in a web address.
    private static final Map<String, String> SPECIAL_JOBS = Map.ofEntries(
        Map.entry(":", "It separates the protocol from the address (like https:)."),
        Map.entry("/", "It separates folders in a path."),
        Map.entry("?", "It marks where the options part of an address starts."),
        Map.entry("&", "It separates one option from the next."),
        Map.entry("=", "It joins an option name to its value."),
        Map.entry("#", "It marks a spot inside the page."),
        Map.entry("@", "It separates a username from the website."),
        Map.entry("%", "It is the escape marker itself, so a real % must be escaped too."),
        Map.entry("+", "Inside forms it means 'space', so a real + must be escaped.")
    );

    @Override
    public String getName() {
        return "urlEncode";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        return URLEncoder.encode(input, StandardCharsets.UTF_8);
    }

    @Override
    public List<StepDetail> explain(String input, Map<String, String> params) {
        // Look at one character at a time and record what happened to it.
        List<Map<String, Object>> chars = new ArrayList<>();
        int kept = 0, encoded = 0, spaces = 0, total = 0;

        int i = 0;
        while (i < input.length()) {
            int codePoint = input.codePointAt(i);
            i += Character.charCount(codePoint);
            String ch = new String(Character.toChars(codePoint));
            String out = URLEncoder.encode(ch, StandardCharsets.UTF_8);
            String kind = ch.equals(" ") ? "space" : out.equals(ch) ? "kept" : "encoded";

            total++;
            if (kind.equals("kept")) kept++;
            else if (kind.equals("space")) spaces++;
            else encoded++;

            if (chars.size() < MAX_CHARS_SHOWN) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("ch", ch);
                entry.put("kind", kind);
                entry.put("out", out);
                entry.put("hex", hexBytes(ch));
                entry.put("reason", reasonFor(ch, kind));
                chars.add(entry);
            }
        }

        String output = apply(input, params);
        boolean roundTrip = URLDecoder.decode(output, StandardCharsets.UTF_8).equals(input);

        List<Map<String, String>> legend = StepDetail.legend(
            "kept", "Safe: stays the same",
            "encoded", "Unsafe: disguised as a % code",
            "space", "Space: becomes +");

        List<StepDetail> steps = new ArrayList<>();

        steps.add(new StepDetail(
            "Why do web addresses need encoding?",
            "URLs may only contain a small set of ASCII characters, and several characters (: / ? & = #) "
                + "have reserved meanings. Percent-encoding replaces every other character with a % sign "
                + "followed by the byte value in hex. Java's URLEncoder also turns a space into +.",
            data(
                "kind", "urlWhy",
                "intro", true,
                "plain", "A web address is like a postal address: it can only use a small set of normal "
                    + "characters, and a few of them have special jobs. If your text contains anything else, "
                    + "it has to be written in a safe code so nothing gets misread."
            )
        ));

        steps.add(new StepDetail(
            "Check every character",
            "Each character is tested against the safe list: A-Z, a-z, 0-9 and . - _ *. A safe character is "
                + "copied unchanged. A space becomes +. Anything else is converted to UTF-8 bytes and every "
                + "byte is written as %XX in hex.",
            data(
                "kind", "pairs",
                "legend", legend,
                "plain", "The computer goes through your text one character at a time and asks: is this "
                    + "character safe? Letters and digits are safe and stay the same. Everything else is "
                    + "unsafe and gets disguised. Click any character to see why.",
                "chars", chars,
                "total", total,
                "truncated", total > chars.size()
            )
        ));

        steps.add(new StepDetail(
            "Put the pieces together",
            "The per-character results are concatenated in order to build the encoded string. "
                + "Because every unsafe byte becomes exactly three characters (%XX), the output is never shorter "
                + "than the input, and decoding reverses it exactly.",
            data(
                "kind", "pairsResult",
                "legend", legend,
                "plain", "Safe characters are kept, unsafe ones become a % followed by their code, and "
                    + "spaces become a +. Putting all the pieces side by side gives the encoded text. "
                    + "Nothing is lost: URL decode turns it back into exactly what you typed.",
                "chars", chars,
                "counts", List.of(
                    StepDetail.count(kept, "kept as they are", "msg"),
                    StepDetail.count(encoded, "disguised as % codes", "len"),
                    StepDetail.count(spaces, "spaces turned into +", "one")),
                "inputLength", total,
                "outputLength", output.length(),
                "check", check(roundTrip, "Decoding the result gives back exactly your original text."),
                "truncated", total > chars.size()
            )
        ));

        return steps;
    }

    private static Map<String, Object> check(boolean ok, String text) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("ok", ok);
        c.put("text", text);
        return c;
    }

    private static String reasonFor(String ch, String kind) {
        if (kind.equals("kept")) {
            return "Letters, digits and . - _ * are safe, so it stays exactly as it is.";
        }
        if (kind.equals("space")) {
            return "A space is not allowed in a web address, so it is written as +.";
        }
        String special = SPECIAL_JOBS.get(ch);
        if (special != null) {
            return special + " So a plain '" + ch + "' inside your text would be misread, and it is disguised.";
        }
        int bytes = ch.getBytes(StandardCharsets.UTF_8).length;
        if (bytes > 1) {
            return "It is not a plain English letter. Computers store it as " + bytes
                + " bytes, so it becomes " + bytes + " codes (one % code per byte).";
        }
        return "It is not on the safe list, so it is disguised as a % code.";
    }

    private static String hexBytes(String ch) {
        StringBuilder sb = new StringBuilder();
        for (byte b : ch.getBytes(StandardCharsets.UTF_8)) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }

    private static Map<String, Object> data(Object... keysAndValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            map.put((String) keysAndValues[i], keysAndValues[i + 1]);
        }
        return map;
    }
}