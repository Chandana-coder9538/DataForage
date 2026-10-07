package com.bheerappa.dataforge.operations;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Recipe {

    /**
     * What happened in one recipe step: what went in, what came out,
     * and the teaching steps that explain how (empty if the operation
     * has no explanation yet).
     */
    public record StepResult(String name, String input, String output, List<StepDetail> details) {
    }

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

    /** Same as bake(), but keeps every step's input, output and explanation. */
    public List<StepResult> bakeWithSteps(String input, Map<String, String> params) throws Exception {
        List<StepResult> results = new ArrayList<>();
        String currentValue = input;
        for (Operations step : steps) {
            String output = step.apply(currentValue, params);
            List<StepDetail> details = step.explain(currentValue, params);
            results.add(new StepResult(step.getName(), currentValue, output, details));
            currentValue = output;
        }
        return results;
    }
}