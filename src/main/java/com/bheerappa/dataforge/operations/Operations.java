

package com.bheerappa.dataforge.operations;

import java.util.List;
import java.util.Map;

public interface Operations {

    String getName();

    String apply(String input, Map<String, String> params) throws Exception;

    /**
     * Teaching steps that show HOW this operation turns input into output.
     * Operations that don't explain themselves yet inherit this default
     * and simply return an empty list.
     */
    default List<StepDetail> explain(String input, Map<String, String> params) throws Exception {
        return List.of();
    }
}