package com.bheerappa.dataforge.operations;

/** Thrown when one step of a recipe cannot run, so the user knows which step failed and why. */
public class StepFailedException extends RuntimeException {

    private final int stepNumber;
    private final String operation;

    public StepFailedException(int stepNumber, String operation, Throwable cause) {
        super("Step " + stepNumber + " (" + operation + ") failed: " + describe(cause), cause);
        this.stepNumber = stepNumber;
        this.operation = operation;
    }

    public int getStepNumber() {
        return stepNumber;
    }

    public String getOperation() {
        return operation;
    }

    private static String describe(Throwable cause) {
        String message = cause.getMessage();
        return (message == null || message.isBlank()) ? cause.getClass().getSimpleName() : message;
    }
}