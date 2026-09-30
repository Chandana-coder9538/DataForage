package com.bheerappa.dataforge.operations;

import org.springframework.stereotype.Component;
import java.util.Base64;
import java.util.Map;

@Component
public class Base64EncodeOperation implements Operations {

    @Override
    public String getName() {
        return "toBase64";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        return Base64.getEncoder().encodeToString(input.getBytes());
    }
}