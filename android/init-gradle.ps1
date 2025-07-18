# Download Gradle wrapper
$gradleVersion = "8.13"
$gradleUrl = "https://services.gradle.org/distributions/gradle-${gradleVersion}-bin.zip"
$gradleZip = "gradle-${gradleVersion}-bin.zip"
$gradleDir = "gradle-${gradleVersion}"

# Download Gradle
Write-Host "Downloading Gradle $gradleVersion..."
Invoke-WebRequest -Uri $gradleUrl -OutFile $gradleZip

# Extract Gradle
Write-Host "Extracting Gradle..."
Expand-Archive -Path $gradleZip -DestinationPath . -Force

# Create wrapper files
Write-Host "Creating Gradle wrapper..."
$gradleBin = ".\$gradleDir\bin\gradle.bat"
& $gradleBin wrapper --gradle-version $gradleVersion --distribution-type bin

# Clean up
Write-Host "Cleaning up..."
Remove-Item -Path $gradleZip -Force
Remove-Item -Path $gradleDir -Recurse -Force

Write-Host "Gradle wrapper has been initialized with version $gradleVersion"
