param (
    [Parameter(Mandatory=$true,HelpMessage="Test or Production")]
    [ValidateSet("Test", "Production")]
    [string]
    $environment,
    [Parameter(Mandatory=$true,HelpMessage="The three number version for this release")]
    [string]
    $version,
    [Parameter(Mandatory=$true,HelpMessage="Get a personal access token from https://octopus-deploy.visualstudio.com/_details/security/tokens following the instructions https://www.visualstudio.com/en-us/integrate/extensions/publish/command-line")]
    [string]
    $accessToken,
    [Parameter(Mandatory=$true,HelpMessage="The path where the vsix file is")]
    [string]
    $packagePath,
    [Parameter(Mandatory=$true,HelpMessage="The path where the manifest files are")]
    [string]
    $manifestsPath,
    [string]
    $shareWith="octopus-deploy-test"
)

$ErrorActionPreference = "Stop"

function IsPublishRequired($extensionManifest){
    $manifest = Get-Content $extensionManifest | ConvertFrom-Json
	Write-Host "Checking whether publish is required for '$($manifest.publisher)' extension id '$($manifest.id)' version '$version'"
    $versions = & tfx extension show --publisher $manifest.publisher --extension-id $manifest.id --token $accessToken --json --no-prompt | ConvertFrom-Json | Select-Object -ExpandProperty versions | Group-Object -AsHashTable -Property version
    return !($versions.ContainsKey($version))
}

function PublishVSIX($vsixFile, $environment) {
    $manifest = "$manifestsPath/dist/extension-manifest.$environment.json"

    if(!($environment -eq "Production") -and !($environment -eq "Test")){
        throw "The valid environments are 'Test' and 'Production'"
    }

    if(!(IsPublishRequired $manifest)){
        Write-Host "Version already published. Skipping publishing."
        return;
    }

    if ($environment -eq "Production") {
        Write-Host "Publishing $vsixFile to everyone (public extension)..."
        & tfx extension publish --vsix $vsixFile --token $accessToken --no-prompt
    } elseif ($environment -eq "Test") {
        Write-Host "Publishing $vsixFile as a private extension, sharing with $shareWith"
        & tfx extension publish --vsix $vsixFile --token $accessToken --share-with $shareWith --no-prompt
    }
}

function PublishAllExtensions($environment) {
    Write-Output "Looking for VSIX file(s) to publish in $packagePath..."

    $vsixFiles = Get-ChildItem $packagePath -Include "*$version.vsix" -Recurse
    if ($vsixFiles) {
        foreach ($vsixFile in $vsixFiles) {
            PublishVSIX $vsixFile $environment
            New-OctopusArtifact -Path $vsixFile
        }
    } else {
        Write-Error "There were no VSIX files found for *$version.vsix in $packagePath"
    }
}

PublishAllExtensions $environment
