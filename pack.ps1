param (
    [Parameter(Mandatory=$true,HelpMessage="LocalTest, Test or Production")]
    [ValidateSet("LocalTest", "Test", "Production")]
    [string]
    $environment,
    [Parameter(Mandatory=$true,HelpMessage="The three number version for this release")]
    [string]
    $version,
    [string]
    $basePath = $PSScriptRoot,
    [string]
    $certificatePath = "$PSScriptRoot/certificates/OctopusDevelopment.pfx",
    [string]
    $certificatePassword
)

$signing_timestamp_urls = @(
		"http://timestamp.globalsign.com/scripts/timestamp.dll",
		"http://www.startssl.com/timestamp",
		"http://timestamp.comodoca.com/rfc3161",
		"http://timestamp.verisign.com/scripts/timstamp.dll",
		"http://tsa.starfieldtech.com")

$ErrorActionPreference = "Stop"

$buildDirectoryPath = "$basePath/dist"
$buildArtifactsPath = "$buildDirectoryPath/Artifacts"

function CleanNodeModules() {
    $command = "node-prune.exe";

    if ($null -eq (Get-Command node-prune -ErrorAction SilentlyContinue))
    {
        $command = "$($env:GOPATH)\bin\node-prune.exe"

        if(-Not (Test-Path $command)){
            Write-Error "Install go and then install node-prune (https://github.com/tj/node-prune)"
            Write-Error "go get github.com/tj/node-prune/cmd/node-prune"
            Exit 1
        }
    }

    Invoke-Expression "$command $($basePath)\dist\tasks\CreateOctopusRelease\node_modules"
    Invoke-Expression "$command $($basePath)\dist\tasks\Deploy\node_modules"
    Invoke-Expression "$command $($basePath)\dist\tasks\OctoCli\node_modules"
    Invoke-Expression "$command $($basePath)\dist\tasks\OctoInstaller\node_modules"
    Invoke-Expression "$command $($basePath)\dist\tasks\Pack\node_modules"
    Invoke-Expression "$command $($basePath)\dist\tasks\Promote\node_modules"
    Invoke-Expression "$command $($basePath)\dist\tasks\Push\node_modules"
}

function UpdateTfxCli() {
    Write-Host "Updating tfx-cli..."
    & npm up -g tfx-cli
}

function UpdateExtensionManifestOverrideFile($workingDirectory, $environment, $version) {
    Write-Host "Finding environment-specific manifest overrides..."
    $overridesSourceFilePath = "$workingDirectory/extension-manifest.$environment.json"
    $overridesSourceFile = Get-ChildItem -Path $overridesSourceFilePath
    if ($null -eq $overridesSourceFile) {
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
        $task.version.Major = $netVersion.Major
        $task.version.Minor = $netVersion.Minor
        $task.version.Patch = $netVersion.Build

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

        try {
            "{}" | Out-File -FilePath $packageFile -Encoding utf8
            Push-Location $directory

            Invoke-Expression "& npm install $dependencies"
        } finally {
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

function SignAndTimeStamp($assemblies, $display, $displayUrl, $certificatePath, $certificatePassword) {

    $signtool_path = ".\tools\signtool\signtool.exe"
    $items = Get-ChildItem -Path $assemblies -Recurse -Exclude "*vshost.exe" -File -Include *.exe,*.dll

    if ($certificatePath -ne "") {
        write-host "Signing and time-stamping assemblies, certificate path: $certificatePath"
        foreach ($assembly in $items)
        {
            if(HasAuthenticodeSignature($assembly) -eq $true) {
                write-host "Skipping $assembly as it is already signed."
                continue
            }

            if ($display -eq "") {
                & "$signtool_path" sign /fd SHA256 /f $certificatePath /p $certificatePassword $assembly | write-host
            } else {
                & "$signtool_path" sign /fd SHA256 /f $certificatePath /p $certificatePassword /d "$display" /du "$displayUrl" $assembly | write-host
            }

            foreach ($url in $signing_timestamp_urls) {
                write-host "  Trying to time stamp $assembly using $url"
                & "$signtool_path" timestamp /tr $url "$assembly" | write-host
                if ($?) {
                    break
                }
            }
            if (!($?)) {
                write-error "Failed to sign $assembly"
                break
            }
        }
        if ($?) {
            write-host "Completed signing and time stamping"
        }
    }
    else {
        write-error "Missing certificatePath, did not sign or time stamp assemblies"
    }
}

function HasAuthenticodeSignature($fileToCheck) {
    try {
    [System.Security.Cryptography.X509Certificates]::X509Certificate.CreateFromSignedFile($fileToCheck.FullPath)
    return $true;
    } catch {
    return $false;
    }
}

UpdateTfxCli
InstallTaskDependencies $buildDirectoryPath
CleanNodeModules
SignAndTimeStamp $buildDirectoryPath "Octopus Deploy Integration for Azure Dev Ops" "https://octopus.com" $certificatePath $certificatePassword
Pack "VSTSExtensions" $environment $buildDirectoryPath
