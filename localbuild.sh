#!/bin/bash
rm -r dist
npm run build -- --extensionVersion $1
rm -r modules
mkdir dist
pwsh -NoProfile -ExecutionPolicy Unrestricted ./pack.ps1 LocalTest $1 -setupTaskDependencies