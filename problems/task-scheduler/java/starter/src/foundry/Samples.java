package foundry;

import java.util.LinkedHashMap;
import java.util.Map;

/** Pipeline files from two product teams, used by the demo and the tests. */
public final class Samples {
    public static final String WEB_APP = """
            # Storefront web app: build, test and ship on every merge to main.
            install:
              duration: 2

            compile:
              duration: 4
              after: install

            lint:
              duration: 1
              after: install

            unit-tests:
              duration: 5
              after: compile

            seed-db:
              duration: 3
              resource: postgres

            e2e-tests:
              duration: 6
              after:
                - compile
                - seed-db
              resource: chrome

            package:
              duration: 2
              after: unit-tests, lint

            deploy:
              duration: 3
              after: [package, e2e-tests]
            """;

    public static final String MOBILE_RELEASE = """
            # Mobile release: build both apps, test them, sign them, publish to the stores.
            fetch-deps:
              duration: 2

            build-android:
              duration: 6
              after: fetch-deps
              resource: linux

            build-ios:
              duration: 8
              after: fetch-deps
              resource: macos

            unit-tests:
              duration: 4
              after: fetch-deps

            ui-tests:
              duration: 9
              after: build-android, build-ios
              resource: macos

            sign-apk:
              duration: 1
              after: build-android

            sign-ipa:
              duration: 2
              after: build-ios
              resource: macos

            publish:
              duration: 2
              after:
                - sign-apk
                - sign-ipa
                - ui-tests
                - unit-tests
            """;

    /** The sample pipelines the demo prints, by name. */
    public static final Map<String, String> SAMPLES = new LinkedHashMap<>();

    static {
        SAMPLES.put("web-app", WEB_APP);
        SAMPLES.put("mobile-release", MOBILE_RELEASE);
    }

    private Samples() {}
}
