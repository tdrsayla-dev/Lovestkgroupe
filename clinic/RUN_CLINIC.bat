@echo off
title Starting Clinic System Server...
echo ===================================================
echo   Clinic System Local Server (HTTP Server)
echo ===================================================
echo.
echo Starting local web server on port 8085...
echo Launching: http://localhost:8085/Clinic.html
echo.
start http://localhost:8085/Clinic.html
python -m http.server 8085 --directory "%~dp0"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] WARNING: Python is not installed or not in PATH.
    echo Trying fallback PowerShell web server on port 8085...
    powershell -NoProfile -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8085/'); $listener.Start(); Write-Host 'Server running at http://localhost:8085/ (Press Ctrl+C to stop)'; while ($listener.IsListening) { $context = $listener.GetContext(); $req = $context.Request; $res = $context.Response; $relPath = $req.Url.LocalPath.TrimStart('/').Replace('/', '\'); if ($relPath -eq '') { $relPath = 'Clinic.html'; }; $filePath = Join-Path '%~dp0' $relPath; if (Test-Path $filePath -PathType Leaf) { $bytes = [System.IO.File]::ReadAllBytes($filePath); $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length); } else { $res.StatusCode = 404; }; $res.OutputStream.Close(); }"
)
pause
