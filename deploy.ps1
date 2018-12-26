$ErrorActionPreference = "Stop"

$environment = $OctopusParameters["Octopus.Environment.Name"]
$version = $OctopusParameters["Octopus.Release.Number"]
$accessToken = $OctopusParameters["AccessToken"]
$shareWith = $OctopusParameters["ShareWith"]
$publish = [System.Convert]::ToBoolean($OctopusParameters["Publish"])
$embeddedOctoVersion = $OctopusParameters["EmbeddedOctoVersion"]
$toolsPath =  $OctopusParameters["ToolsPath"]

& "$PSScriptRoot\embed-octo.ps1" -version $embeddedOctoVersion -override $toolsPath
& "$PSScriptRoot\pack.ps1" -environment $environment -version $version
if ($publish) {
    & "$PSScriptRoot\publish.ps1" -environment $environment -version $version -accessToken $accessToken -shareWith $shareWith
}

$vsixPackages = Get-ChildItem "$PSScriptRoot\dist\Artifacts\$environment\*.vsix"

foreach ($vsix in $vsixPackages) {
    New-OctopusArtifact -Path $vsix
}
