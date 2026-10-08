package com.bheerappa.dataforge.operations;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

@Component
public class Base64EncodeOperation implements Operations {

    static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    private static final int MAX_GROUPS_SHOWN = 6;

    @Override
    public String getName() {
        return "toBase64";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        return Base64.getEncoder().encodeToString(input.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public List<StepDetail> explain(String input, Map<String, String> params) {
        byte[] bytes = input.getBytes(StandardCharsets.UTF_8);
        String output = apply(input, params);
        int totalGroups = (bytes.length + 2) / 3;

        List<Map<String, Object>> groups = new ArrayList<>();
        for (int g = 0; g < Math.min(totalGroups, MAX_GROUPS_SHOWN); g++) {
            int start = g * 3;
            int count = Math.min(3, bytes.length - start);

            List<Map<String, Object>> byteList = new ArrayList<>();
            int bits24 = 0;
            for (int k = 0; k < 3; k++) {
                int value = k < count ? bytes[start + k] & 0xff : 0;
                bits24 = (bits24 << 8) | value;
                if (k < count) {
                    Map<String, Object> b = new LinkedHashMap<>();
                    b.put("label", label(value));
                    b.put("hex", String.format("%02x", value));
                    b.put("bits", bits(value, 8));
                    byteList.add(b);
                }
            }

            List<String> pieces = new ArrayList<>();
            List<Integer> indexes = new ArrayList<>();
            List<String> symbols = new ArrayList<>();
            int realSymbols = count + 1; // 1 byte -> 2 symbols, 2 -> 3, 3 -> 4
            for (int p = 0; p < 4; p++) {
                int index = (bits24 >> (18 - 6 * p)) & 0x3f;
                pieces.add(bits(index, 6));
                if (p < realSymbols) {
                    indexes.add(index);
                    symbols.add(String.valueOf(ALPHABET.charAt(index)));
                } else {
                    indexes.add(-1);
                    symbols.add("=");
                }
            }

            Map<String, Object> group = new LinkedHashMap<>();
            group.put("bytes", byteList);
            group.put("missingBytes", 3 - count);
            group.put("pieces", pieces);
            group.put("indexes", indexes);
            group.put("symbols", symbols);
            groups.add(group);
        }

        int padding = output.endsWith("==") ? 2 : output.endsWith("=") ? 1 : 0;

        List<StepDetail> steps = new ArrayList<>();
        steps.add(StepDetail.of(
            "The Base64 alphabet",
            "Base64 maps every 6-bit value (0 to 63) to one of 64 printable ASCII characters: A-Z, a-z, 0-9, + and /.",
            "kind", "b64Alphabet",
            "intro", true,
            "plain", "Some places (emails, web addresses, JSON files) only handle plain, safe text. Base64 rewrites "
                + "any data using just 64 safe symbols: capital letters, small letters, digits, + and /. "
                + "Every symbol has a number from 0 to 63, like a secret code book.",
            "alphabet", ALPHABET
        ));
        steps.add(StepDetail.of(
            "Turn 3 letters into 4 symbols",
            "The input bytes are processed in groups of 3 (24 bits). Each group is re-split into four 6-bit values "
                + "and each value is looked up in the alphabet. A short last group is padded with = signs.",
            "kind", "b64Groups",
            "direction", "encode",
            "plain", "The computer takes your text three letters at a time. Three letters are 24 bits. It regroups "
                + "those 24 bits into four smaller pieces of 6 bits. Each piece is a number from 0 to 63, "
                + "and the code book turns that number into a symbol.",
            "groups", groups,
            "totalGroups", totalGroups,
            "truncated", totalGroups > groups.size()
        ));
        steps.add(StepDetail.of(
            "Put the symbols together",
            "The symbols from all groups are concatenated. Output length is 4 * ceil(n / 3), so Base64 is about "
                + "33% larger than the input.",
            "kind", "b64Result",
            "direction", "encode",
            "plain", "All the symbols are joined side by side. Every 3 letters became 4 symbols, so the result is "
                + "a little longer. If your text did not fill the last group of 3, one or two = signs "
                + "are added at the end to show that.",
            "input", input,
            "output", output,
            "inputCount", bytes.length,
            "outputCount", output.length(),
            "padding", padding
        ));
        return steps;
    }

    static String bits(int value, int width) {
        return String.format("%" + width + "s", Integer.toBinaryString(value)).replace(' ', '0');
    }

    /** A short readable label for a byte: the character if it is printable ASCII. */
    static String label(int value) {
        if (value == 0x20) return "\u2423";
        if (value > 0x20 && value < 0x7f) return String.valueOf((char) value);
        return "\u00B7";
    }
}