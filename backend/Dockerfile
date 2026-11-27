FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
# Cached until pom.xml changes, so code edits don't download dependencies again.
RUN mvn -B -q dependency:go-offline
COPY src src
# Tests need Postgres; `make test` runs them.
RUN mvn -B -q package -Dmaven.test.skip=true

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN adduser -D -u 10001 app
COPY --from=build /app/target/connectfour-*.jar app.jar
USER 10001
ENV SERVER_PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "app.jar"]
