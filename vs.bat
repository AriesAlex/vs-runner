@echo off
cd %userprofile%\Documents\Projects
if [%1]==[] goto runner
git clone %1
goto runner

:runner
cd %userprofile%\Documents\Projects\vs-runner
node .