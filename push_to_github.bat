@echo off
echo ========================================================
echo   Pushing CSE D Timetable to GitHub (24/7 Cloud OTA)
echo   Repo: https://github.com/krishnapanday4196-gif/sec-d-timetable
echo ========================================================
echo.
git add -A
git commit -m "Update timetable files and version.json for 24/7 OTA"
git branch -M main
git push -u origin main
echo.
echo ========================================================
echo   DONE! Check your repository on GitHub.
echo ========================================================
pause
