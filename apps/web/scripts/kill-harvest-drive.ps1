# Kill any node.exe running harvest-drive.mjs
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'harvest-drive' } | ForEach-Object {
  Write-Output ("killing " + $_.ProcessId + ": " + $_.CommandLine.Substring(0, [Math]::Min(120, $_.CommandLine.Length)))
  Stop-Process -Id $_.ProcessId -Force
}
Write-Output "done"
