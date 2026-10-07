package com.bheerappa.dataforge.operations;

import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

@Component
public class Sha256Operation implements Operations {

    @Override
    public String getName() {
        return "sha256";
    }

    @Override
    public String apply(String input, Map<String, String> params) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashBytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hashBytes);
    }

    @Override
    public List<StepDetail> explain(String input, Map<String, String> params) throws Exception {
        return Sha256Explainer.explain(input);
    }
}