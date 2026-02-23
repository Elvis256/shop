@echo off
echo Starting PleasureZone Shop...
echo.

REM Start backend in a new window
start "Backend Server" cmd /k "cd /d C:\SHOP\shop\backend && npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend in a new window
start "Frontend Server" cmd /k "cd /d C:\SHOP\shop\frontend && npm run dev"

echo.
echo Servers starting...
echo - Backend: http://localhost:4000
echo - Frontend: http://localhost:8080
echo - Admin: http://localhost:8080/admin
echo.
pause
