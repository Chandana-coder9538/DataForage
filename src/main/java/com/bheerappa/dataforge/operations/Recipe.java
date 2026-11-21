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

    /** One operation plus the settings the user chose for it. */
    private record Step(Operations operation, Map<String, String> params) {
    }

    private final List<Step> steps = new ArrayList<>();

    public void addStep(Operations operation, Map<String, String> params) {
        steps.add(new Step(operation, params == null ? Map.of() : params));
    }

    public void addStep(Operations operation) {
        addStep(operation, Map.of());
    }

    public String bake(String input) {
        String currentValue = input;
        for (int i = 0; i < steps.size(); i++) {
            Step step = steps.get(i);
            currentValue = applyStep(step, currentValue, i);
        }
        return currentValue;
    }

    /** Same as bake(), but keeps every step's input, output and explanation. */
    public List<StepResult> bakeWithSteps(String input) {
        List<StepResult> results = new ArrayList<>();
        String currentValue = input;
        for (int i = 0; i < steps.size(); i++) {
            Step step = steps.get(i);
            String output = applyStep(step, currentValue, i);
            List<StepDetail> details = explainStep(step, currentValue, i);
            results.add(new StepResult(step.operation().getName(), currentValue, output, details));
            currentValue = output;
        }
        return results;
    }

    private String applyStep(Step step, String value, int index) {
        try {
            return step.operation().apply(value, step.params());
        } catch (Exception e) {
            throw new StepFailedException(index + 1, step.operation().getName(), e);
        }
    }

    private List<StepDetail> explainStep(Step step, String value, int index) {
        try {
            return step.operation().explain(value, step.params());
        } catch (Exception e) {
            throw new StepFailedException(index + 1, step.operation().getName(), e);
        }
    }
}