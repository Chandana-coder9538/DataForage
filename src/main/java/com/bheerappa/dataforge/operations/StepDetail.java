
package com.bheerappa.dataforge.operations;

import java.util.Map;

/**
 * One teaching step shown to the user, e.g. "Padding" or "Message schedule".
 *
 * title       - short heading, e.g. "Step 2: Padding"
 * explanation - plain-English description of what happened and why
 * data        - the actual values for the frontend to draw
 *               (hex strings, bit strings, word lists, ...)
 */
public record StepDetail(String title, String explanation, Map<String, Object> data) {
}