# Kill any node.exe running import-curated
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'import-curated' } | ForEach-Object {
  Write-Output ("killing " + $_.ProcessId)
  Stop-Process -Id $_.ProcessId -Force
}
Write-Output "done"
