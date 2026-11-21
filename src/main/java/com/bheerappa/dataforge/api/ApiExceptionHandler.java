package com.bheerappa.dataforge.api;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.bheerappa.dataforge.operations.StepFailedException;

/** Turns exceptions into readable JSON errors instead of a blank 500 page. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(StepFailedException.class)
    public ResponseEntity<Map<String, Object>> stepFailed(StepFailedException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", e.getMessage());
        body.put("step", e.getStepNumber());
        body.put("operation", e.getOperation());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /** Thrown by OperationRegistry for an unknown operation name. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> badRequest(IllegalArgumentException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
