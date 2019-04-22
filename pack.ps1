param (
    [Parameter(Mandatory=$true,HelpMessage="LocalTest, Test or Production")]
    [ValidateSet("LocalTest", "Test", "Production")]
    [string]
    $environment,
    [Parameter(Mandatory=$true,HelpMessage="The three number version for this release")]
    [string]
    $version,
    [string]
    $basePath = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

$buildDirectoryPath = "$basePath/dist"
$buildArtifactsPath = "$buildDirectoryPath/Artifacts"

function CleanNodeModules() {
    $command = "node-prune";

    if ((Get-Command node-prune -ErrorAction SilentlyContinue) -eq $null)
    {
        $command = "$($env:GOPATH)/bin/node-prune"

        if(-Not (Test-Path $command)){
            Write-Error "Install go and then install node-prune (https://github.com/tj/node-prune)"
            Write-Error "go get github.com/tj/node-prune/cmd/node-prune"
            Exit 1
        }
    }

    Invoke-Expression "$command $($basePath)/dist/tasks/CreateOctopusRelease/CreateOctopusReleaseV3/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/CreateOctopusRelease/CreateOctopusReleaseV4/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/Deploy/DeployV3/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/Deploy/DeployV4/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/OctoCli/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/OctoInstaller/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/Pack/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/Metadata/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/Promote/PromoteV3/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/Promote/PromoteV4/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/Push/PushV3/node_modules"
    Invoke-Expression "$command $($basePath)/dist/tasks/Push/PushV4/node_modules"
}

function UpdateTfxCli() {
    Write-Host "Updating tfx-cli..."
    & npm up -g tfx-cli
}

function UpdateExtensionManifestOverrideFile($workingDirectory, $environment, $version) {
    Write-Host "Finding environment-specific manifest overrides..."
    $overridesSourceFilePath = "$workingDirectory/extension-manifest.$environment.json"
    $overridesSourceFile = Get-ChildItem -Path $overridesSourceFilePath
    if ($overridesSourceFile -eq $null) {
        Write-Error "Could not find the extension-manifest override file: $overridesSourceFilePath"
        return $null
    }

    Write-Host "Using $overridesSourceFile for overriding the standard extension-manifest.json, updating version to $version..."
    $manifest = ConvertFrom-JSON -InputObject (Get-Content $overridesSourceFile -Raw)
    $manifest.version = $version

    $overridesFilePath = "$workingDirectory/extension-manifest.$environment.$version.json"
    ConvertTo-JSON $manifest -Depth 6 | Out-File $overridesFilePath -Encoding ASCII # tfx-cli doesn't support UTF8 with BOM
    Get-Content $overridesFilePath | Write-Host
    return Get-Item $overridesFilePath
}

function UpdateTaskManifests($workingDirectory, $version, $envName) {
    $taskManifestFiles = Get-ChildItem $workingDirectory -Include "task.json" -Recurse
    foreach ($taskManifestFile in $taskManifestFiles) {
        Write-Host "Updating version to $version in $taskManifestFile..."
        $task = ConvertFrom-JSON -InputObject (Get-Content $taskManifestFile -Raw)
        $netVersion = [System.Version]::Parse($version)

        if ($task.version.Major -ne 3) {
            $task.version.Major  = $netVersion.Major
            $task.version.Minor = $netVersion.Minor
            $task.version.Patch = $netVersion.Build
        }

        $task.helpMarkDown = "Version: $version. [More Information](https://g.octopushq.com/TFS-VSTS)"

        # replace the task ID
        $task.id = Get-TaskId $envName $task.name

        ConvertTo-JSON $task -Depth 6 | Out-File $taskManifestFile -Encoding UTF8
    }
}

function Get-ObjectMembers {
    [CmdletBinding()]
    Param(
        [Parameter(Mandatory=$True, ValueFromPipeline=$True)]
        [PSCustomObject]$obj
    )
    $obj | Get-Member -MemberType NoteProperty | ForEach-Object {
        $key = $_.Name
        [PSCustomObject]@{Key = $key; Value = $obj."$key"}
    }
}

function InstallTaskDependencies($workingDirectory) {
    $taskManifestFiles = Get-ChildItem $workingDirectory -Include "task.json" -Recurse
    $dependencies = (ConvertFrom-JSON (Get-Content "$basePath/package.json" -Raw)).dependencies | Get-ObjectMembers | foreach { $dependencies="" } {$dependencies += "$($_.Key)@$($_.Value) "} {$dependencies}

    foreach ($manifestFile in $taskManifestFiles){
        $directory = Split-Path -parent $manifestFile
        $packageFile = Join-Path $directory "package.json"

        try{
            "{}" | Out-File -FilePath $packageFile -Encoding utf8
            Push-Location $directory

            Invoke-Expression "& npm install $dependencies"
        }finally{
            Remove-Item $packageFile
            Pop-Location
        }
    }
}

function Get-TaskId($envName, $taskName) {
    $taskIds = ConvertFrom-Json -InputObject (Get-Content "$basePath/task-ids.json" -Raw)
    $result = $taskIds.$envName.$taskName

    if([String]::IsNullOrEmpty($result))
    {
        throw "Could not find task $taskName ID for environment $envName. Failing as this is required and will prevent the extension from installing otherwise."
    }
    return $result
}

function OverrideExtensionLogo($workingDirectory, $environment) {
    $extensionLogoOverrideFile = Get-Item "$workingDirectory/extension-icon.$environment.png" -ErrorAction SilentlyContinue
    if ($extensionLogoOverrideFile) {
        $directory = Split-Path $extensionLogoOverrideFile
        $target = Join-Path $directory "extension-icon.png"
        Write-Host "Replacing extension logo with $extensionLogoOverrideFile..."
        Move-Item $extensionLogoOverrideFile $target -Force
    }

    Remove-Item "$workingDirectory/extension-icon.*.png" -Force
}

function OverrideTaskLogos($workingDirectory, $environment) {
    $taskLogoOverrideFiles = Get-ChildItem $extensionBuildTempPath -Include "icon.$environment.png" -Recurse
    foreach ($logoOverrideFile in $taskLogoOverrideFiles) {
        $directory = Split-Path $logoOverrideFile
        $target = Join-Path $directory "icon.png"
        Write-Host "Replacing task logo $target with $logoOverrideFile..."
        Move-Item $logoOverrideFile $target -Force
    }

    Get-ChildItem $workingDirectory -Include "icon.*.png" -Recurse | Remove-Item -Force
}

function Pack($envName, $environment, $workingDirectory) {
    Write-Host "Packing $extensionName at $workingDirectory"

    $overridesFile = UpdateExtensionManifestOverrideFile $workingDirectory $environment $version
    OverrideExtensionLogo $workingDirectory $environment

    UpdateTaskManifests $workingDirectory $version $environment
    OverrideTaskLogos $workingDirectory $environment

    Write-Host "Creating VSIX using tfx..."
    & tfx extension create --root $workingDirectory --manifest-globs extension-manifest.json --overridesFile $overridesFile --outputPath "$buildArtifactsPath/$environment" --no-prompt
}

UpdateTfxCli
InstallTaskDependencies $buildDirectoryPath
CleanNodeModules
Pack "VSTSExtensions" $environment $buildDirectoryPath
