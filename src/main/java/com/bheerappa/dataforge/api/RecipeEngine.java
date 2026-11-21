package com.bheerappa.dataforge.api;

import java.util.List;

import org.springframework.stereotype.Service;

import com.bheerappa.dataforge.operations.OperationRegistry;
import com.bheerappa.dataforge.operations.Operations;
import com.bheerappa.dataforge.operations.Recipe;

@Service
public class RecipeEngine {

    private final OperationRegistry registry;

    public RecipeEngine(OperationRegistry registry) {
        this.registry = registry;
    }

    public String run(RecipeRequest request) {
        return buildRecipe(request).bake(inputOf(request));
    }

    /** Like run(), but returns every step's input, output and explanation. */
    public List<Recipe.StepResult> runWithSteps(RecipeRequest request) {
        return buildRecipe(request).bakeWithSteps(inputOf(request));
    }

    private String inputOf(RecipeRequest request) {
        return request.getInput() == null ? "" : request.getInput();
    }

    private Recipe buildRecipe(RecipeRequest request) {
        Recipe recipe = new Recipe();
        if (request.getRecipe() == null) {
            return recipe;
        }
        for (RecipeStep step : request.getRecipe()) {
            Operations operation = registry.getByName(step.getName());
            recipe.addStep(operation, step.getParams());
        }
        return recipe;
    }
}