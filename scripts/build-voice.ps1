param(
    [Parameter(Mandatory=$true)][string]$Model,
    [Parameter(Mandatory=$true)][string]$Voices,
    [string]$Python = 'python'
)
$ErrorActionPreference = 'Stop'
& $Python (Join-Path $PSScriptRoot 'design-voice.py') $Model $Voices
if ($LASTEXITCODE -ne 0) { throw 'Could not build the English announcer assets.' }
