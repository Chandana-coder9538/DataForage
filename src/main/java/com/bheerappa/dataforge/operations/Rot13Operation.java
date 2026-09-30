package com.bheerappa.dataforge.operations;

import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class Rot13Operation implements Operations {

    @Override
    public String getName() {
        return "rot13";
    }

    @Override
    public String apply(String input, Map<String, String> params) {
        StringBuilder result = new StringBuilder();
        for (char c : input.toCharArray()) {
            result.append(rotateChar(c));
        }
        return result.toString();
    }

    private char rotateChar(char c) {
        if (c >= 'a' && c <= 'z') return (char) ('a' + (c - 'a' + 13) % 26);
        if (c >= 'A' && c <= 'Z') return (char) ('A' + (c - 'A' + 13) % 26);
        return c;
    }
}