@echo off
setlocal

REM Download Gradle wrapper files
curl -L -o gradle-wrapper.jar https://repo.maven.apache.org/maven2/org/gradle/wrapper/gradle-wrapper/8.13/gradle-wrapper-8.13.jar
curl -L -o gradle-wrapper.properties https://raw.githubusercontent.com/gradle/gradle/v8.13/gradle/wrapper/gradle-wrapper.properties

REM Update gradle-wrapper.properties
echo distributionBase=GRADLE_USER_HOME> gradle\wrapper\gradle-wrapper.properties
echo distributionPath=wrapper/dists>> gradle\wrapper\gradle-wrapper.properties
echo distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip>> gradle\wrapper\gradle-wrapper.properties
echo networkTimeout=10000>> gradle\wrapper\gradle-wrapper.properties
echo validateDistributionUrl=true>> gradle\wrapper\gradle-wrapper.properties
echo zipStoreBase=GRADLE_USER_HOME>> gradle\wrapper\gradle-wrapper.properties
echo zipStorePath=wrapper/dists>> gradle\wrapper\gradle-wrapper.properties

REM Download Gradle wrapper script
curl -L -o gradlew https://raw.githubusercontent.com/gradle/gradle/v8.13/gradlew

REM Make gradlew executable
icacls gradlew /grant "%USERNAME%:F" /T

endlocal
