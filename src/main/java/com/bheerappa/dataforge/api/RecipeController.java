package com.bheerappa.dataforge.api;

import com.bheerappa.dataforge.operations.Recipe;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class RecipeController {

    private final RecipeEngine engine;

    public RecipeController(RecipeEngine engine) {
        this.engine = engine;
    }

    @PostMapping("/api/bake")
    public Map<String, Object> bake(@RequestBody RecipeRequest request) throws Exception {
        List<Recipe.StepResult> steps = engine.runWithSteps(request);

        // The final output is the last step's output (or the input itself for an empty recipe).
        String output = steps.isEmpty() ? request.getInput() : steps.get(steps.size() - 1).output();

        return Map.of("output", output, "steps", steps);
    }
}