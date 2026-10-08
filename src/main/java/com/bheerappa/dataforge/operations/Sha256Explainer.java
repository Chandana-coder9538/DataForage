package com.bheerappa.dataforge.operations;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A hand-written SHA-256 that records every stage as a StepDetail,
 * so the frontend can teach how a hash is built.
 *
 * It is for learning only: real hashing in DataForge still goes through
 * MessageDigest. We compare our result with MessageDigest at the end
 * to prove the walkthrough is correct.
 */
public final class Sha256Explainer {

    // Round constants: the first 32 bits of the fractional parts of the
    // cube roots of the first 64 primes.
    private static final int[] K = {
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    };

    // Initial hash state: the first 32 bits of the fractional parts of the
    // square roots of the first 8 primes.
    private static final int[] H_INIT = {
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    };

    // Keep responses small even if someone hashes a huge input.
    private static final int MAX_BYTES_SHOWN = 64;
    private static final int MAX_PADDED_BYTES_SHOWN = 256;
    private static final int MAX_BLOCKS_SHOWN = 4;

    private Sha256Explainer() {
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /** Hashes bytes with our own implementation (no recording). */
    public static String hash(byte[] message) {
        return toHex(digest(message, null));
    }

    /** Builds the full list of teaching steps for the given text. */
    public static List<StepDetail> explain(String input) throws NoSuchAlgorithmException {
        byte[] message = input.getBytes(StandardCharsets.UTF_8);
        List<StepDetail> steps = new ArrayList<>();

        steps.add(overviewStep());
        steps.add(bytesStep(input, message));

        byte[] padded = pad(message);
        steps.add(paddingStep(message, padded));
        steps.add(blocksStep(padded));

        // Run the real algorithm once, recording what happens in block 1.
        Recording recording = new Recording();
        int[] finalState = digest(message, recording);

        steps.add(scheduleStep(recording));
        steps.add(roundsStep(recording));
        steps.add(finalStep(finalState, recording, message));
        if (message.length > 0) {
            steps.add(avalancheStep(input, message));
        }
        return steps;
    }

    // ------------------------------------------------------------------
    // The algorithm itself
    // ------------------------------------------------------------------

    /** Padding: message + 0x80 + zeros + 64-bit length, total a multiple of 64 bytes. */
    private static byte[] pad(byte[] message) {
        int n = message.length;
        int paddedLength = ((n + 9 + 63) / 64) * 64;
        byte[] padded = new byte[paddedLength];
        System.arraycopy(message, 0, padded, 0, n);
        padded[n] = (byte) 0x80;
        long bitLength = (long) n * 8;
        for (int i = 0; i < 8; i++) {
            padded[paddedLength - 1 - i] = (byte) (bitLength >>> (8 * i));
        }
        return padded;
    }

    /** Runs every block through the compression function and returns the final 8 words. */
    private static int[] digest(byte[] message, Recording recording) {
        byte[] padded = pad(message);
        int[] state = H_INIT.clone();

        for (int block = 0; block < padded.length / 64; block++) {
            int[] words = new int[16];
            for (int i = 0; i < 16; i++) {
                int offset = block * 64 + i * 4;
                words[i] = ((padded[offset] & 0xff) << 24)
                        | ((padded[offset + 1] & 0xff) << 16)
                        | ((padded[offset + 2] & 0xff) << 8)
                        | (padded[offset + 3] & 0xff);
            }

            int[] before = state.clone();
            boolean record = recording != null && block == 0;
            int[] working = compress(state, words, record ? recording : null);

            // Davies-Meyer step: add the working variables back into the state.
            for (int i = 0; i < 8; i++) {
                state[i] = before[i] + working[i];
            }

            if (recording != null) {
                recording.blocks.add(new int[][] {before, working, state.clone()});
            }
        }
        return state;
    }

    /** Message schedule + 64 rounds for one block. Returns working variables a..h. */
    private static int[] compress(int[] state, int[] words, Recording recording) {
        int[] w = new int[64];
        System.arraycopy(words, 0, w, 0, 16);
        for (int t = 16; t < 64; t++) {
            w[t] = smallSigma1(w[t - 2]) + w[t - 7] + smallSigma0(w[t - 15]) + w[t - 16];
        }

        int a = state[0], b = state[1], c = state[2], d = state[3];
        int e = state[4], f = state[5], g = state[6], h = state[7];

        if (recording != null) {
            recording.schedule = w.clone();
        }

        for (int t = 0; t < 64; t++) {
            int t1 = h + bigSigma1(e) + ch(e, f, g) + K[t] + w[t];
            int t2 = bigSigma0(a) + maj(a, b, c);

            if (recording != null && t == 0) {
                recording.round0 = new int[] {a, b, c, d, e, f, g, h, t1, t2};
            }

            h = g;
            g = f;
            f = e;
            e = d + t1;
            d = c;
            c = b;
            b = a;
            a = t1 + t2;

            if (recording != null) {
                recording.rounds.add(new int[] {t, K[t], w[t], t1, t2, a, b, c, d, e, f, g, h});
            }
        }
        return new int[] {a, b, c, d, e, f, g, h};
    }

    private static int rotr(int x, int n) {
        return (x >>> n) | (x << (32 - n));
    }

    private static int smallSigma0(int x) {
        return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
    }

    private static int smallSigma1(int x) {
        return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10);
    }

    private static int bigSigma0(int x) {
        return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
    }

    private static int bigSigma1(int x) {
        return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
    }

    /** Choose: for each bit, if e is 1 take f, otherwise take g. */
    private static int ch(int e, int f, int g) {
        return (e & f) ^ (~e & g);
    }

    /** Majority: for each bit, take whichever value at least two of a, b, c have. */
    private static int maj(int a, int b, int c) {
        return (a & b) ^ (a & c) ^ (b & c);
    }

    // ------------------------------------------------------------------
    // Building the teaching steps
    // ------------------------------------------------------------------

    private static StepDetail overviewStep() {
        List<Map<String, String>> properties = List.of(
            property("Deterministic", "The same input always gives exactly the same hash."),
            property("Fixed size", "Any input, from one letter to a whole movie, becomes 256 bits (64 hex characters)."),
            property("One-way", "You can compute the hash from the input, but there is no practical way to go back."),
            property("Avalanche effect", "Changing one tiny bit of the input changes about half of the output bits."),
            property("Collision resistant", "Finding two different inputs with the same hash is practically impossible.")
        );
        return new StepDetail(
            "What is a hash?",
            "A hash function is a fingerprint machine. It reads any amount of data and produces a short, "
                + "fixed-size fingerprint. SHA-256 does this by mixing the data again and again with bit "
                + "operations until the result looks random. The steps below show exactly how.",
            data(
                "intro", true,
                "plain", "A hash is like a fingerprint for text. Put any text in and you get a short code out. "
                    + "The same text always gives the same code, but you can never rebuild the text from the code. "
                    + "People use hashes to check that data has not changed and to store passwords safely.",
                "properties", properties
            )
        );
    }

    private static StepDetail bytesStep(String input, byte[] message) {
        int shown = Math.min(message.length, MAX_BYTES_SHOWN);
        List<String> hex = new ArrayList<>();
        List<String> binary = new ArrayList<>();
        for (int i = 0; i < shown; i++) {
            int value = message[i] & 0xff;
            hex.add(String.format("%02x", value));
            binary.add(String.format("%8s", Integer.toBinaryString(value)).replace(' ', '0'));
        }
        return new StepDetail(
            "Turn your text into numbers",
            "Computers hash numbers, not letters. The text is first converted to bytes using UTF-8. "
                + "Each byte is 8 bits, shown here in hex and in binary.",
            data(
                "plain", "Computers cannot work with letters directly, so every character is first changed into "
                    + "a number. For example the letter h is 104. Those numbers are then written in binary, "
                    + "the 0s and 1s a computer really uses.",
                "text", input,
                "byteCount", message.length,
                "bytesHex", hex,
                "bytesBinary", binary,
                "truncated", message.length > shown
            )
        );
    }

    private static StepDetail paddingStep(byte[] message, byte[] padded) {
        int n = message.length;
        int zeroBytes = padded.length - n - 1 - 8;
        long bitLength = (long) n * 8;

        Map<String, Object> d = new LinkedHashMap<>();
        d.put("plain", "SHA-256 works on fixed-size boxes of 64 characters. Your text is smaller, so the rest of "
            + "the box is topped up with filler, and the length of your text is written at the end. "
            + "Nothing is lost, the box is just filled up.");
        d.put("messageBytes", n);
        d.put("originalBits", bitLength);
        d.put("paddedBytes", padded.length);
        d.put("paddedBits", padded.length * 8);
        d.put("oneBitByte", "80");
        d.put("zeroBytes", zeroBytes);
        d.put("lengthHex", String.format("%016x", bitLength));
        if (padded.length <= MAX_PADDED_BYTES_SHOWN) {
            d.put("paddedHex", toHex(padded));
            d.put("truncated", false);
        } else {
            d.put("tailHex", toHex(Arrays.copyOfRange(padded, padded.length - 64, padded.length)));
            d.put("truncated", true);
        }

        return new StepDetail(
            "Fill up the box",
            "SHA-256 only works on blocks of exactly 512 bits (64 bytes). So the message is padded: "
                + "first a single 1 bit (the byte 0x80), then zeros, and finally the original length "
                + "as a 64-bit number. Because the length is included, 'a' and 'a\\0' never get the same padding.",
            d
        );
    }

    private static StepDetail blocksStep(byte[] padded) {
        int totalBlocks = padded.length / 64;
        List<List<String>> blocks = new ArrayList<>();
        for (int block = 0; block < Math.min(totalBlocks, MAX_BLOCKS_SHOWN); block++) {
            List<String> words = new ArrayList<>();
            for (int i = 0; i < 16; i++) {
                int o = block * 64 + i * 4;
                words.add(String.format("%02x%02x%02x%02x",
                    padded[o] & 0xff, padded[o + 1] & 0xff, padded[o + 2] & 0xff, padded[o + 3] & 0xff));
            }
            blocks.add(words);
        }
        return new StepDetail(
            "Cut into pieces",
            "The padded message is cut into 512-bit blocks. Each block is read as sixteen 32-bit words "
                + "(W0 to W15). Blocks are processed one after another, and each block's result feeds "
                + "into the next.",
            data(
                "techOnly", true,
                "plain", "The filled box is cut into 16 small pieces called words. If your text needs more than "
                    + "one box, the boxes are handled one after another, each one building on the last.",
                "totalBlocks", totalBlocks, "blocks", blocks, "truncated", totalBlocks > MAX_BLOCKS_SHOWN
            )
        );
    }

    private static StepDetail scheduleStep(Recording r) {
        List<String> schedule = hexList(r.schedule);

        // Worked example: how W16 is built from earlier words.
        int[] w = r.schedule;
        Map<String, Object> example = new LinkedHashMap<>();
        example.put("t", 16);
        example.put("w_t_minus_16", hex(w[0]));
        example.put("sigma0_of_w_t_minus_15", hex(smallSigma0(w[1])));
        example.put("w_t_minus_7", hex(w[9]));
        example.put("sigma1_of_w_t_minus_2", hex(smallSigma1(w[14])));
        example.put("result", hex(w[16]));

        return new StepDetail(
            "Blend the pieces together",
            "Sixteen words are not enough for 64 rounds, so they are stretched to 64. Each new word W[t] "
                + "is built from four earlier words: W[t-16] + sigma0(W[t-15]) + W[t-7] + sigma1(W[t-2]), "
                + "where sigma0 and sigma1 rotate and shift bits. This spreads every input bit across "
                + "many words. (Shown for the first block.)",
            data(
                "techOnly", true,
                "plain", "Sixteen pieces are not enough to mix well, so the machine blends them together to "
                    + "make 48 more, 64 in total. Each new piece is a mixture of earlier pieces, like "
                    + "stirring paint colours together.",
                "words", schedule, "example", example
            )
        );
    }

    private static StepDetail roundsStep(Recording r) {
        List<Map<String, Object>> rounds = new ArrayList<>();
        for (int[] row : r.rounds) {
            Map<String, Object> round = new LinkedHashMap<>();
            round.put("t", row[0]);
            round.put("k", hex(row[1]));
            round.put("w", hex(row[2]));
            round.put("t1", hex(row[3]));
            round.put("t2", hex(row[4]));
            round.put("state", hexList(Arrays.copyOfRange(row, 5, 13)));
            rounds.add(round);
        }

        int[] s = r.round0;
        Map<String, Object> example = new LinkedHashMap<>();
        example.put("e", bin(s[4]));
        example.put("f", bin(s[5]));
        example.put("g", bin(s[6]));
        example.put("ch", bin(ch(s[4], s[5], s[6])));
        example.put("a", bin(s[0]));
        example.put("b", bin(s[1]));
        example.put("c", bin(s[2]));
        example.put("maj", bin(maj(s[0], s[1], s[2])));
        example.put("sigma1_e", hex(bigSigma1(s[4])));
        example.put("sigma0_a", hex(bigSigma0(s[0])));
        example.put("t1", hex(s[8]));
        example.put("t2", hex(s[9]));

        return new StepDetail(
            "Scramble it 64 times",
            "Eight working variables a to h start from the current hash state. In each of the 64 rounds, "
                + "two temporary values are computed: T1 = h + Sigma1(e) + Ch(e,f,g) + K[t] + W[t] and "
                + "T2 = Sigma0(a) + Maj(a,b,c). Then every variable shifts one place (h=g, g=f, f=e, ...), "
                + "with e = d + T1 and a = T1 + T2. Ch picks bits from f or g depending on e; Maj takes the "
                + "majority vote of a, b and c. K[t] are fixed constants derived from prime numbers. "
                + "(Shown for the first block.)",
            data(
                "plain", "Now comes the main mixing, 64 rounds of it. Imagine 8 cups of paint. In every round the "
                    + "machine pours, stirs and swaps colours between the cups and adds one new piece. After 64 "
                    + "rounds your original text is completely scrambled.",
                "initialState", hexList(r.blocks.get(0)[0]), "rounds", rounds, "round0", example
            )
        );
    }

    private static StepDetail finalStep(int[] finalState, Recording r, byte[] message) throws NoSuchAlgorithmException {
        List<Map<String, Object>> blocks = new ArrayList<>();
        for (int i = 0; i < Math.min(r.blocks.size(), MAX_BLOCKS_SHOWN); i++) {
            int[][] b = r.blocks.get(i);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("block", i + 1);
            entry.put("before", hexList(b[0]));
            entry.put("working", hexList(b[1]));
            entry.put("after", hexList(b[2]));
            blocks.add(entry);
        }

        String ours = toHex(finalState);
        String jdk = toHex(MessageDigest.getInstance("SHA-256").digest(message));

        return new StepDetail(
            "Read off the fingerprint",
            "After the 64 rounds, the working variables are added word by word to the state the block "
                + "started with. This addition is what makes the process one-way, because the original "
                + "state is mixed back in. After the last block, the eight 32-bit words are joined together "
                + "to give the 256-bit hash.",
            data(
                "plain", "The 8 mixed numbers are written side by side. That string of 64 letters and digits is "
                    + "your hash, the fingerprint of your text.",
                "totalBlocks", r.blocks.size(),
                "blocks", blocks,
                "digest", ours,
                "matchesJdk", ours.equals(jdk)
            )
        );
    }

    private static StepDetail avalancheStep(String input, byte[] message) {
        byte[] changed = message.clone();
        changed[changed.length - 1] ^= 0x01; // flip the lowest bit of the last byte

        int[] original = digest(message, null);
        int[] flipped = digest(changed, null);

        StringBuilder mask = new StringBuilder();
        int differing = 0;
        for (int i = 0; i < 8; i++) {
            int diff = original[i] ^ flipped[i];
            differing += Integer.bitCount(diff);
            mask.append(bin(diff));
        }

        return new StepDetail(
            "Change one letter, everything changes",
            "Now we flip just ONE bit of the input (the last bit of the last byte) and hash again. "
                + "A good hash changes about half of its 256 output bits, so the two hashes look "
                + "completely unrelated. This is why you cannot 'get close' to a target hash.",
            data(
                "plain", "Change just one tiny thing in the text and the fingerprint comes out completely "
                    + "different. That is why nobody can nearly match a hash, and why hashes are so good "
                    + "at spotting even the smallest change.",
                "originalText", input,
                "changedText", new String(changed, StandardCharsets.UTF_8),
                "originalHash", toHex(original),
                "changedHash", toHex(flipped),
                "diffBits", differing,
                "totalBits", 256,
                "diffMask", mask.toString()
            )
        );
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------

    /** Everything we capture while hashing block 1, plus a summary of every block. */
    private static final class Recording {
        int[] schedule;
        int[] round0;
        final List<int[]> rounds = new ArrayList<>();
        final List<int[][]> blocks = new ArrayList<>(); // each: {before, working, after}
    }

    private static Map<String, String> property(String name, String text) {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("name", name);
        p.put("text", text);
        return p;
    }

    /** Builds an ordered map from alternating key, value arguments. */
    private static Map<String, Object> data(Object... keysAndValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            map.put((String) keysAndValues[i], keysAndValues[i + 1]);
        }
        return map;
    }

    private static String hex(int word) {
        return String.format("%08x", word);
    }

    private static String bin(int word) {
        return String.format("%32s", Integer.toBinaryString(word)).replace(' ', '0');
    }

    private static List<String> hexList(int[] words) {
        List<String> list = new ArrayList<>();
        for (int word : words) {
            list.add(hex(word));
        }
        return list;
    }

    private static String toHex(int[] words) {
        StringBuilder sb = new StringBuilder();
        for (int word : words) {
            sb.append(hex(word));
        }
        return sb.toString();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }
}