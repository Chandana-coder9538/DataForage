package com.bheerappa.dataforge.operations;

import org.springframework.stereotype.Component;
import java.security.MessageDigest;
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
        byte[] hashBytes = digest.digest(input.getBytes());

        StringBuilder hexString = new StringBuilder();
        for (byte b : hashBytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }

        return hexString.toString();
    }
}