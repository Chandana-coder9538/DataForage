package com.bheerappa.dataforge.operations;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Recipe {

    private final List<Operations> steps = new ArrayList<>();

    public void addStep(Operations operation) {
        steps.add(operation);
    }

    public String bake(String input, Map<String, String> params) throws Exception {
        String currentValue = input;
        for (Operations step : steps) {
            currentValue = step.apply(currentValue, params);
        }
        return currentValue;
    }
}