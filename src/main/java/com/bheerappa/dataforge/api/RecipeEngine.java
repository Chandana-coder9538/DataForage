package com.bheerappa.dataforge.api;

import com.bheerappa.dataforge.operations.Operations;
import com.bheerappa.dataforge.operations.OperationRegistry;
import com.bheerappa.dataforge.operations.Recipe;
import org.springframework.stereotype.Service;

@Service
public class RecipeEngine {

    private final OperationRegistry registry;

    public RecipeEngine(OperationRegistry registry) {
        this.registry = registry;
    }

    public String run(RecipeRequest request) throws Exception {
        Recipe recipe = new Recipe();

        for (RecipeStep step : request.getRecipe()) {
            Operations operation = registry.getByName(step.getName());
            recipe.addStep(operation);
        }

        return recipe.bake(request.getInput(), null);
    }
}