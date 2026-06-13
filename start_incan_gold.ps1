$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://127.0.0.1:5173/'
$stdoutLog = Join-Path $projectRoot 'dev-server.log'
$stderrLog = Join-Path $projectRoot 'dev-server.err.log'

function Test-GameServer {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-GameServer)) {
  Start-Process `
    -WindowStyle Hidden `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173') `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

  $ready = $false
  for ($attempt = 0; $attempt -lt 15; $attempt += 1) {
    Start-Sleep -Seconds 1
    if (Test-GameServer) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    throw "The game server could not start. Check dev-server.err.log."
  }
}

Start-Process $url
