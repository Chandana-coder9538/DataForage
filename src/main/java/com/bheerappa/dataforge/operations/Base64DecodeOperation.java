package com.bheerappa.dataforge.operations;

import org.springframework.stereotype.Component;
import java.util.Base64;
import java.util.Map;

@Component
public class Base64DecodeOperation implements Operations {

    @Override
    public String getName() {
        return "fromBase64";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        return new String(Base64.getDecoder().decode(input));
    }
}