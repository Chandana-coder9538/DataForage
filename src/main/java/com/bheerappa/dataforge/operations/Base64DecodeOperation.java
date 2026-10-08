package com.bheerappa.dataforge.operations;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class Base64DecodeOperation implements Operations {

    private static final int MAX_GROUPS_SHOWN = 6;

    @Override
    public String getName() {
        return "fromBase64";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        return new String(Base64.getDecoder().decode(input), StandardCharsets.UTF_8);
    }

    @Override
    public List<StepDetail> explain(String input, Map<String, String> params) {
        String alphabet = Base64EncodeOperation.ALPHABET;
        String output = apply(input, params);
        int totalGroups = (input.length() + 3) / 4;

        List<Map<String, Object>> groups = new ArrayList<>();
        for (int g = 0; g < Math.min(totalGroups, MAX_GROUPS_SHOWN); g++) {
            int start = g * 4;
            String text = input.substring(start, Math.min(start + 4, input.length()));

            List<String> symbols = new ArrayList<>();
            List<Integer> indexes = new ArrayList<>();
            List<String> pieces = new ArrayList<>();
            int bits24 = 0;
            int real = 0;
            for (int p = 0; p < 4; p++) {
                char c = p < text.length() ? text.charAt(p) : '=';
                int index = c == '=' ? -1 : alphabet.indexOf(c);
                if (index >= 0) real++;
                symbols.add(String.valueOf(c));
                indexes.add(index);
                pieces.add(Base64EncodeOperation.bits(Math.max(index, 0), 6));
                bits24 = (bits24 << 6) | Math.max(index, 0);
            }

            int byteCount = Math.max(real - 1, 0); // 2 symbols -> 1 byte, 3 -> 2, 4 -> 3
            List<Map<String, Object>> byteList = new ArrayList<>();
            for (int k = 0; k < byteCount; k++) {
                int value = (bits24 >> (16 - 8 * k)) & 0xff;
                Map<String, Object> b = new LinkedHashMap<>();
                b.put("label", Base64EncodeOperation.label(value));
                b.put("hex", String.format("%02x", value));
                b.put("bits", Base64EncodeOperation.bits(value, 8));
                byteList.add(b);
            }

            Map<String, Object> group = new LinkedHashMap<>();
            group.put("symbols", symbols);
            group.put("indexes", indexes);
            group.put("pieces", pieces);
            group.put("bytes", byteList);
            group.put("missingBytes", 3 - byteCount);
            groups.add(group);
        }

        int padding = input.endsWith("==") ? 2 : input.endsWith("=") ? 1 : 0;

        List<StepDetail> steps = new ArrayList<>();
        steps.add(StepDetail.of(
            "The Base64 alphabet",
            "Base64 maps every 6-bit value (0 to 63) to one of 64 printable ASCII characters. Decoding looks each "
                + "character up in the same table, in the other direction.",
            "kind", "b64Alphabet",
            "intro", true,
            "plain", "Base64 text is made only from 64 safe symbols, and every symbol has a number from 0 to 63 in "
                + "a code book. Decoding is the same code book used backwards: symbol to number, "
                + "number to the original letters.",
            "alphabet", alphabet
        ));
        steps.add(StepDetail.of(
            "Turn 4 symbols back into 3 letters",
            "The text is read in groups of 4 symbols. Each symbol becomes a 6-bit number; the four numbers are "
                + "joined into 24 bits and cut into three 8-bit bytes. = signs mark missing bytes.",
            "kind", "b64Groups",
            "direction", "decode",
            "plain", "The computer reads four symbols at a time and looks up each one's number (0 to 63). "
                + "Each number is written as 6 bits. Joining four pieces gives 24 bits, which are cut into "
                + "three groups of 8 bits: your original letters.",
            "groups", groups,
            "totalGroups", totalGroups,
            "truncated", totalGroups > groups.size()
        ));
        steps.add(StepDetail.of(
            "Put the letters together",
            "The decoded bytes are concatenated and interpreted as UTF-8 text.",
            "kind", "b64Result",
            "direction", "decode",
            "plain", "All the recovered letters are joined together, and you get your original text back. "
                + "The = signs at the end were only there to fill up the last group, so they disappear.",
            "input", input,
            "output", output,
            "inputCount", input.length(),
            "outputCount", output.getBytes(StandardCharsets.UTF_8).length,
            "padding", padding
        ));
        return steps;
    }
}