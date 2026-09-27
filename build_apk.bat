@echo off
echo ========================================================
echo    Building CSE D Timetable Android APK
echo ========================================================

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\krish\AppData\Local\Android\Sdk"
set "GRADLE_BAT=C:\Users\krish\.gradle\wrapper\dists\gradle-9.5.0-bin\bvnork1r7n8i6kp5cnkibsc9q\gradle-9.5.0\bin\gradle.bat"

echo.
echo [1/3] Synchronizing web assets into Android project...
copy /Y "e:\sec d\index.html" "e:\sec d\android\app\src\main\assets\index.html" >nul
copy /Y "e:\sec d\manifest.json" "e:\sec d\android\app\src\main\assets\manifest.json" >nul
copy /Y "e:\sec d\logo.png" "e:\sec d\android\app\src\main\assets\logo.png" >nul
copy /Y "e:\sec d\icon-192.png" "e:\sec d\android\app\src\main\assets\icon-192.png" >nul
copy /Y "e:\sec d\icon-512.png" "e:\sec d\android\app\src\main\assets\icon-512.png" >nul

echo [2/3] Compiling and packaging APK with Gradle...
call "%GRADLE_BAT%" -p "e:\sec d\android" assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [3/3] Copying generated APK to workspace root...
    copy /Y "e:\sec d\android\app\build\outputs\apk\debug\app-debug.apk" "e:\sec d\CSE_D_Timetable.apk" >nul
    copy /Y "e:\sec d\android\app\build\outputs\apk\debug\app-debug.apk" "e:\sec d\SecD_Timetable.apk" >nul
    echo.
    echo ========================================================
    echo    SUCCESS! APK generated:
    echo    - e:\sec d\CSE_D_Timetable.apk
    echo    - e:\sec d\SecD_Timetable.apk
    echo ========================================================
) else (
    echo.
    echo [ERROR] Build failed! Check the output above.
)
