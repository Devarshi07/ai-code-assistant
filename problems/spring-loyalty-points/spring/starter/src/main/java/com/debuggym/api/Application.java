package com.debuggym.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.time.Clock;

/** Bean and Brew loyalty service: members earn points on purchases and redeem them for rewards. */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    /** Every rule that depends on "today" reads this clock, so tests can replace it. */
    @Bean
    public Clock systemClock() {
        return Clock.systemUTC();
    }
}
