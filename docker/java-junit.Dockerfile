# Runtime for guided problems in Java: JDK 21 and the JUnit 5 console launcher
# (one self-contained jar). Built once by the app (debug-gym/java-junit:1);
# workspace containers run it offline.
FROM eclipse-temurin:21-jdk-alpine
RUN mkdir -p /opt/junit \
 && wget -q -O /opt/junit/junit.jar https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.11.4/junit-platform-console-standalone-1.11.4.jar \
 && java -jar /opt/junit/junit.jar --version > /dev/null
