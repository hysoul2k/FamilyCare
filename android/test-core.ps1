$ErrorActionPreference = 'Stop'
$taskJava = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin' } else { 'C:/Program Files/Android/Android Studio/jbr/bin' }
$out = Join-Path $PSScriptRoot 'test-build'
& (Join-Path $taskJava 'javac.exe') -d $out (Join-Path $PSScriptRoot 'app/src/main/java/vn/familycare/child/PolicyRules.java') (Join-Path $PSScriptRoot 'app/src/main/java/vn/familycare/child/TelemetryRules.java') (Join-Path $PSScriptRoot 'app/src/test/java/vn/familycare/child/PolicyRulesTest.java')
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed' }
& (Join-Path $taskJava 'java.exe') -cp $out vn.familycare.child.PolicyRulesTest
if ($LASTEXITCODE -ne 0) { throw 'Policy checks failed' }
