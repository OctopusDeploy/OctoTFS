param (
    [Parameter(HelpMessage="The octo cli version to use")]
    [string]
    $version = "latest"
)

$tempFile = "${env:TEMP}\$(New-Guid).zip"

function Get-LatestVersion($releaseUrl){
    return Invoke-RestMethod $releasesUrl -Method Get | Select-Object -ExpandProperty tag_name
}

function Resolve-Version($version, $releasesUrl){
    if([string]::IsNullOrEmpty($version) -or $version -ieq "latest"){
        return Get-LatestVersion($releasesUrl)
    }

    return $version
}

try{
    [Net.ServicePointManager]::SecurityProtocol = `
    [Net.SecurityProtocolType]::Tls12 -bor `
    [Net.SecurityProtocolType]::Tls11 -bor `
    [Net.SecurityProtocolType]::Tls -bor `
    [Net.SecurityProtocolType]::Ssl3

    $releasesUrl = "https://api.github.com/repos/OctopusDeploy/OctopusClients/releases/latest";
    $version = Resolve-Version $version $releasesUrl
    Write-Host "Updating to version $version"
    $downloadUrl = "https://download.octopusdeploy.com/octopus-tools/${version}/OctopusTools.${version}.portable.zip"
    Write-Debug "Fetching from $downloadUrl"
    $destination = "$PSScriptRoot\source\VSTSExtensions\OctopusBuildAndReleaseTasks\Tasks\Common"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile
    Expand-Archive $tempFile -DestinationPath $destination -Force
    Write-Host "Successfully updated to octo $version"
} finally {
    if(Test-Path $tempFile){
        Remove-Item $tempFile
    }
}