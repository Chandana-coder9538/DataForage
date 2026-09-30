package com.bheerappa.dataforge.operations;

import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class OperationRegistry {

    private final Map<String, Operations> operationsByName = new HashMap<>();

    public OperationRegistry(List<Operations> allOperations) {
        for (Operations operation : allOperations) {
            operationsByName.put(operation.getName(), operation);
        }
    }

    public Operations getByName(String name) {
        Operations operation = operationsByName.get(name);
        if (operation == null) {
            throw new IllegalArgumentException("Unknown operation: " + name);
        }
        return operation;
    }
}