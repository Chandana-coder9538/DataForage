package com.bheerappa.dataforge.api;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class RecipeController {

    private final RecipeEngine engine;

    public RecipeController(RecipeEngine engine) {
        this.engine = engine;
    }

    @PostMapping("/api/bake")
    public Map<String, String> bake(@RequestBody RecipeRequest request) throws Exception {
        String result = engine.run(request);
        return Map.of("output", result);
    }
}