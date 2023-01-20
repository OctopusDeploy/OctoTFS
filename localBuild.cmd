rm -r dist
call npm run build -- --extensionVersion %*
rm -r modules

setlocal
cd "%~dp0"
powershell -NoProfile -ExecutionPolicy Unrestricted .\pack.ps1 LocalTest %* -setupTaskDependencies
