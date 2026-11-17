package com.debuggym.api;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Replaces the system clock with a MutableClock, so every test controls "today". */
@TestConfiguration
public class TestClockConfig {
    @Bean
    @Primary
    public MutableClock testClock() {
        return new MutableClock();
    }
}
