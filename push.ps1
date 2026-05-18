Set-Location $PSScriptRoot
git add .
$msg = Read-Host "Commit 說明（直接 Enter 略過用預設）"
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "update" }
git commit -m $msg
git push
Write-Host "完成！" -ForegroundColor Green
pause
