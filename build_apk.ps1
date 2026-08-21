$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# Prefer the local android-env/ toolchain inside the repo; fall back to system env vars.
$localJdk = Join-Path $root 'android-env\jdk\jdk-17.0.20+8'
$localSdk = Join-Path $root 'android-env\sdk'

if (-not $env:JAVA_HOME -and (Test-Path $localJdk)) {
    $env:JAVA_HOME = $localJdk
}
if (-not $env:ANDROID_HOME -and (Test-Path $localSdk)) {
    $env:ANDROID_HOME = $localSdk
    $env:ANDROID_SDK_ROOT = $localSdk
}

if (-not $env:JAVA_HOME) { throw 'JAVA_HOME is not set and android-env\jdk was not found' }
if (-not $env:ANDROID_HOME) { throw 'ANDROID_HOME is not set and android-env\sdk was not found' }

$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

Push-Location $root
try {
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }

    Push-Location android
    try {
        .\gradlew.bat assembleDebug --no-daemon
        if ($LASTEXITCODE -ne 0) { throw 'gradle build failed' }
    }
    finally {
        Pop-Location
    }

    Copy-Item -LiteralPath "android\app\build\outputs\apk\debug\app-debug.apk" -Destination "Calculator-debug.apk" -Force
    Write-Host "APK generated: $root\Calculator-debug.apk"
}
finally {
    Pop-Location
}
