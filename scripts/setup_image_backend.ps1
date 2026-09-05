$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$installRoot = Join-Path (Split-Path -Parent $projectRoot) "stable-diffusion-webui-forge"
$modelDirectory = Join-Path $installRoot "models\Stable-diffusion"
$modelPath = Join-Path $modelDirectory "v1-5-pruned-emaonly.safetensors"
$forgeRepository = "https://github.com/lllyasviel/stable-diffusion-webui-forge.git"
$modelUrl = "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors?download=true"

if (-not (Test-Path $installRoot)) {
    git clone $forgeRepository $installRoot
} elseif (Test-Path (Join-Path $installRoot ".git")) {
    git -C $installRoot pull --ff-only
} else {
    throw "$installRoot exists but is not a Git checkout. Move it or remove it before running setup."
}

New-Item -ItemType Directory -Force -Path $modelDirectory | Out-Null
curl.exe -L -C - --retry 5 --retry-delay 5 -o $modelPath $modelUrl

$launcher = @"
@echo off
set COMMANDLINE_ARGS=--api --listen --port 7860 --always-offload-from-vram --cuda-malloc --opt-sdp-attention --skip-python-version-check
call webui.bat
"@
Set-Content -Path (Join-Path $installRoot "start-image-api.bat") -Value $launcher -Encoding ascii

Write-Host "Forge setup is ready at $installRoot"
Write-Host "Start it with: $installRoot\start-image-api.bat"
