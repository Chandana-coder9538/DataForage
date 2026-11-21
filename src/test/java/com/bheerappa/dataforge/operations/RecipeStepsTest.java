package com.bheerappa.dataforge.operations;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;

class RecipeStepsTest {

    /** A tiny operation that appends the "suffix" parameter. */
    private static final Operations APPEND = new Operations() {
        @Override
        public String getName() {
            return "append";
        }

        @Override
        public String apply(String input, Map<String, String> params) {
            return input + params.get("suffix");
        }
    };

    private static final Operations BROKEN = new Operations() {
        @Override
        public String getName() {
            return "broken";
        }

        @Override
        public String apply(String input, Map<String, String> params) {
            throw new IllegalArgumentException("bad input");
        }
    };

    @Test
    void eachStepReceivesItsOwnParams() {
        Recipe recipe = new Recipe();
        recipe.addStep(APPEND, Map.of("suffix", "A"));
        recipe.addStep(APPEND, Map.of("suffix", "B"));

        assertEquals("xAB", recipe.bake("x"));
    }

    @Test
    void failingStepIsNamedInTheError() {
        Recipe recipe = new Recipe();
        recipe.addStep(APPEND, Map.of("suffix", "A"));
        recipe.addStep(BROKEN);

        StepFailedException error = assertThrows(StepFailedException.class, () -> recipe.bake("x"));

        assertEquals(2, error.getStepNumber());
        assertEquals("broken", error.getOperation());
        assertEquals("Step 2 (broken) failed: bad input", error.getMessage());
    }
}
