package com.bheerappa.dataforge.api;

import java.util.List;

public class RecipeRequest {

    private String input;
    private List<RecipeStep> recipe;

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }

    public List<RecipeStep> getRecipe() {
        return recipe;
    }

    public void setRecipe(List<RecipeStep> recipe) {
        this.recipe = recipe;
    }
}