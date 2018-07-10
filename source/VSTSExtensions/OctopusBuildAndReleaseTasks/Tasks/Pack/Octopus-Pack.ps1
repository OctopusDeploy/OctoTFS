[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

try {

    . .\Octopus-VSTS.ps1

    $PackageId = Get-VstsInput -Name PackageId -Require
    $PackageFormat = Get-VstsInput -Name PackageFormat -Require
    $PackageVersion = Get-VstsInput -Name PackageVersion
    $OutputPath = Get-VstsInput -Name OutputPath
    $SourcePath = Get-VstsInput -Name SourcePath
    $NuGetAuthor = Get-VstsInput -Name NuGetAuthor
    $NuGetTitle = Get-VstsInput -Name NuGetTitle
    $NuGetDescription = Get-VstsInput -Name NuGetDescription
    $NuGetReleaseNotes = Get-VstsInput -Name NuGetReleaseNotes
    $NuGetReleaseNotesFile = Get-VstsInput -Name NuGetReleaseNotesFile
    $Overwrite = Get-VstsInput -Name Overwrite -AsBool
    $Include = Get-VstsInput -Name Include
    $ListFiles = Get-VstsInput -Name ListFiles -AsBool

    $releaseNotesFileArg = ""
    if ((-not [System.String]::IsNullOrWhiteSpace($NuGetReleaseNotesFile)) -and (Test-Path $NuGetReleaseNotesFile -PathType leaf))
    {
        Write-Host "Release notes file: $NugetReleaseNotesFile"
        $releaseNotesFileArg = "--releaseNotesFile=`"$NugetReleaseNotesFile`""
    } else {
        Write-Host "No Release notes file found"
    }

    if ($OutputPath){
        $OutputPath = $OutputPath.TrimEnd('\')
    }
    if ($SourcePath){
        $SourcePath = $SourcePath.TrimEnd('\')
    }

    # Call Octo.exe
    $octoPath = Get-OctoExePath
    $Arguments = "`"$octoPath`" pack --id=`"$PackageId`" --format=$PackageFormat --version=$PackageVersion --outFolder=`"$OutputPath`" --basePath=`"$SourcePath`" --author=`"$NugetAuthor`" --title=`"$NugetTitle`" --description=`"$NugetDescription`" --releaseNotes=`"$NuGetReleaseNotes`" $releaseNotesFileArg --overwrite=$Overwrite"
    if ($Include) {
       ForEach ($IncludePath in $Include.replace("`r", "").split("`n")) {
       $Arguments = $Arguments + " --include=`"$IncludePath`""
       }
    }
    if ($ListFiles) {
        $Arguments = $Arguments + " --verbose"
    }

    Invoke-VstsTool -FileName "dotnet" -Arguments $Arguments -RequireExitCodeZero

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}

