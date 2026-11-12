# Read-only local preview for the Naxxramas Resource Hub draft.
# Binds ONLY to 127.0.0.1. No publishing, uploads, or modifications.
param(
  [ValidateRange(1024,65535)][int]$Port = 18765,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$index = Join-Path $Root "index.html"
$source = Join-Path $Root "site-content.html"
if (!(Test-Path -LiteralPath $index -PathType Leaf) -or
    !(Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "The full website preview is missing. Extract the complete ZIP before starting."
}

$mimeTypes = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
  ".css"="text/css; charset=utf-8"; ".js"="text/javascript; charset=utf-8"
  ".json"="application/json"; ".svg"="image/svg+xml"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"
  ".gif"="image/gif"; ".webp"="image/webp"; ".ico"="image/x-icon"
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"
  ".wasm"="application/wasm"; ".pdf"="application/pdf"
  ".docx"="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$siteURL = "http://127.0.0.1:$Port/"
try {
  $listener.Start()
  Write-Host ""
  Write-Host "Naxxramas draft preview: $siteURL" -ForegroundColor Green
  Write-Host "Local computer only. No public website changes."
  Write-Host "Press Ctrl+C to stop, or close this window."
  Write-Host ""
  if (!$NoBrowser) { Start-Process $siteURL }

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new(
        $stream,[System.Text.Encoding]::ASCII,$false,1024,$true)
      $request = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($request)) { continue }
      # Consume request headers before sending the response.
      while ($true) {
        $header = $reader.ReadLine()
        if ($null -eq $header -or $header -eq "") { break }
      }
      $parts = $request.Split(" ")
      if ($parts.Length -lt 2) { continue }
      $method = $parts[0]
      $status = 200
      $type = "text/plain; charset=utf-8"
      $filePath = $null
      if ($method -ne "GET" -and $method -ne "HEAD") {
        $status = 405
      } else {
        $rawPath = $parts[1].Split("?")[0]
        $decoded = [System.Uri]::UnescapeDataString($rawPath)

        # The live GitHub Pages website lives below /Naxxramas-Resource-Hub/.
        # The original visual editor intentionally contains that production path.
        # For LOCAL preview only, mirror that prefix back to this checkout root so
        # original navigation/Admin behaviour works unchanged.
        $pagesPrefix = "/Naxxramas-Resource-Hub"
        if ($decoded -eq $pagesPrefix) {
          $decoded = "/"
        } elseif ($decoded.StartsWith($pagesPrefix + "/", [System.StringComparison]::OrdinalIgnoreCase)) {
          $decoded = $decoded.Substring($pagesPrefix.Length)
        }

        $rel = $decoded.TrimStart("/").Replace("/",[System.IO.Path]::DirectorySeparatorChar)
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
        $rootPrefix = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
          [System.IO.Path]::DirectorySeparatorChar
        if ($filePath -ne $Root -and
          !$filePath.StartsWith($rootPrefix,[System.StringComparison]::OrdinalIgnoreCase)) {
          $status = 403
        } else {
          if (Test-Path -LiteralPath $filePath -PathType Container) {
            $filePath = Join-Path $filePath "index.html"
          }
          if (!(Test-Path -LiteralPath $filePath -PathType Leaf)) { $status = 404 }
        }
      }
      if ($status -eq 200) {
        $info = [System.IO.FileInfo]::new($filePath)
        $ext = $info.Extension.ToLowerInvariant()
        if ($mimeTypes.ContainsKey($ext)) { $type = $mimeTypes[$ext] }
        else { $type = "application/octet-stream" }
        $response = "HTTP/1.1 200 OK"
        $length = $info.Length
      } else {
        $response = "HTTP/1.1 $status Error"
        $payload = [System.Text.Encoding]::UTF8.GetBytes("$status - Local preview only")
        $length = $payload.Length
      }
      $head = "$response" + [char]13+[char]10 + "Content-Type: $type" + [char]13+[char]10 +
        "Content-Length: $length" + [char]13+[char]10 +
        "Connection: close" + [char]13+[char]10 +
        "Cache-Control: no-store" + [char]13+[char]10 +
        "X-Content-Type-Options: nosniff" + [char]13+[char]10+[char]13+[char]10
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
      $stream.Write($headerBytes,0,$headerBytes.Length)
      if ($method -ne "HEAD") {
        if ($status -eq 200) {
          $file = [System.IO.File]::OpenRead($filePath)
          try { $file.CopyTo($stream) } finally { $file.Dispose() }
        } else {
          $stream.Write($payload,0,$payload.Length)
        }
      }
      $stream.Flush()
    } catch {
      Write-Host "Request skipped: $($_.Exception.Message)" -ForegroundColor DarkYellow
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}