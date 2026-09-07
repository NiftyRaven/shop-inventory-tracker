@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -Command ^
  "$desk = [Environment]::GetFolderPath('Desktop');" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$s = $ws.CreateShortcut((Join-Path $desk 'Start Inventory.lnk'));" ^
  "$s.TargetPath = (Join-Path '%cd%' 'Start Inventory.bat');" ^
  "$s.WorkingDirectory = '%cd%';" ^
  "$s.WindowStyle = 1;" ^
  "$s.Description = 'AG Innovation Inventory';" ^
  "$s.Save();" ^
  "Write-Host 'A Start Inventory icon is now on your Desktop.'"
echo.
echo  Double-click that Desktop icon after the PC restarts.
echo.
pause
