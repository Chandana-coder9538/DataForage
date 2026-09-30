package com.bheerappa.dataforge.operations;

import java.util.Map;

public interface Operations {

    String getName();

    String apply(String input, Map<String, String> params) throws Exception;
}