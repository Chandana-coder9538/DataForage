package com.bheerappa.dataforge.operations;

import org.springframework.stereotype.Component;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class UrlDecodeOperation implements Operations {

    @Override
    public String getName() {
        return "urlDecode";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        return URLDecoder.decode(input, StandardCharsets.UTF_8);
    }
}