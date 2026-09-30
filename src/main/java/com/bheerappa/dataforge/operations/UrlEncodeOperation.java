package com.bheerappa.dataforge.operations;

import org.springframework.stereotype.Component;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class UrlEncodeOperation implements Operations {

    @Override
    public String getName() {
        return "urlEncode";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        return URLEncoder.encode(input, StandardCharsets.UTF_8);
    }
}