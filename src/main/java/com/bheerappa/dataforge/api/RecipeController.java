package com.bheerappa.dataforge.api;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.bheerappa.dataforge.operations.Recipe;

@RestController
public class RecipeController {

    private final RecipeEngine engine;

    public RecipeController(RecipeEngine engine) {
        this.engine = engine;
    }

    @PostMapping("/api/bake")
    public Map<String, Object> bake(@RequestBody RecipeRequest request) {
        List<Recipe.StepResult> steps = engine.runWithSteps(request);

        // The final output is the last step's output (or the input itself for an empty recipe).
        String input = request.getInput() == null ? "" : request.getInput();
        String output = steps.isEmpty() ? input : steps.get(steps.size() - 1).output();

        return Map.of("output", output, "steps", steps);
    }
}