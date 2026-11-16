# Runtime for guided API projects in Spring Boot 3 (Java 21, Maven).
# Built once by the app (debug-gym/java-spring:1). Building the template project
# fills the local Maven repository, so workspace containers build and test offline.
FROM maven:3.9.9-eclipse-temurin-21
COPY spring-template /opt/template
RUN cd /opt/template && mvn -B -q -Dmaven.repo.local=/opt/m2 test && rm -rf /opt/template/target
ENV MAVEN_OPTS="-Xmx512m -XX:+UseSerialGC -XX:TieredStopAtLevel=1" MAVEN_ARGS="-o -B -Dmaven.repo.local=/opt/m2"
