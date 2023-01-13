rm -r dist
call npm run build
rm -r modules

setlocal
cd "%~dp0"
powershell -NoProfile -ExecutionPolicy Unrestricted .\pack.ps1 LocalTest %* -setupTaskDependencies
