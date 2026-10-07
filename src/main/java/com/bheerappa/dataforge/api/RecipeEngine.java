package com.bheerappa.dataforge.api;

import com.bheerappa.dataforge.operations.Operations;
import com.bheerappa.dataforge.operations.OperationRegistry;
import com.bheerappa.dataforge.operations.Recipe;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RecipeEngine {

    private final OperationRegistry registry;

    public RecipeEngine(OperationRegistry registry) {
        this.registry = registry;
    }

    public String run(RecipeRequest request) throws Exception {
        return buildRecipe(request).bake(request.getInput(), null);
    }

    /** Like run(), but returns every step's input, output and explanation. */
    public List<Recipe.StepResult> runWithSteps(RecipeRequest request) throws Exception {
        return buildRecipe(request).bakeWithSteps(request.getInput(), null);
    }

    private Recipe buildRecipe(RecipeRequest request) {
        Recipe recipe = new Recipe();
        for (RecipeStep step : request.getRecipe()) {
            Operations operation = registry.getByName(step.getName());
            recipe.addStep(operation);
        }
        return recipe;
    }
}