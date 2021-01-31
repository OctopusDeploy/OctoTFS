param (
    [string]
    $version = "latest",
    $platform="portable",
    [string]
    $extension=".zip",
    [string]
    $latestOctoUrl = "https://g.octopushq.com/LatestTools",
    [string]
    $basePath = $PSScriptRoot
)

$buildDirectoryPath = "$basePath/dist"


function Copy-Object($object){
    $result = New-Object PsObject
    $object.psobject.properties | ForEach-Object {
        $result | Add-Member -MemberType $_.MemberType -Name $_.Name -Value $_.Value
    }
    return $result;
}

function Expand-Template($template, $option){
    $result = $template;
    $option.psobject.Properties | ForEach-Object { $result = $result -replace "{\s*$($_.Name)\s*}", $_.Value }
    return $result;
}

function Update-Option($option, [HashTable]$overrides){
    $result = Copy-Object $option
    $overrides.Keys | ForEach-Object { $result.$_ = $overrides[$_] }
    return $result;
}
function Resolve-Version($version, $option) {
    if($version -ieq "latest"){
        return $option
    }else{
      $result = Update-Option $option @{ version = $version }

      $result.location = Expand-Template $result.template $result
      return $result
    }
}

function Resolve-InstallerTask($path){
    $taskManifestFiles = Get-ChildItem $path -Include "task.json" -Recurse
    foreach ($taskManifestFile in $taskManifestFiles) {
        if((Split-Path (Split-Path $taskManifestFile -Parent) -Leaf) -ieq "OctoInstaller")
        {
            return Split-Path $taskManifestFile -Parent
        }
    }
}

function Expand-EmbeddedOctoZip($zipPath, $extractPath) {
    Write-Host "Extracting $zipPath to $extractPath"
    Add-Type -assembly "System.IO.Compression.Filesystem"
    [IO.Compression.Zipfile]::ExtractToDirectory($zipPath, $extractPath)
}


$manifest = Invoke-RestMethod -Uri $latestOctoUrl
$option = $manifest.downloads | Where-Object { $_.platform -ieq $platform -and $_.extension -ieq $extension }
$option = Resolve-Version $version $option
$name = (Split-Path $option.location -Leaf)
$destinationFolder = Join-Path (Resolve-InstallerTask $buildDirectoryPath) "embedded"
$destinationBinFolder = Join-Path $destinationFolder "bin"

if(!(Test-Path $destinationFolder)){
    New-Item -ItemType Directory -Path $destinationFolder | Out-Null
}

$downloadFolder = Join-Path ([System.IO.Path]::GetTempPath()) "octo"
$downloadDestination = Join-Path $downloadFolder $name
Write-Host "Downloading Octo $($option.version) from $($option.location) and saving to $($downloadDestination)"

if(!(Test-Path $downloadFolder)) {
    New-Item -ItemType Directory -Path $downloadFolder | Out-Null   
}

(New-Object System.Net.WebClient).DownloadFile($option.location, $downloadDestination)
Expand-EmbeddedOctoZip $downloadDestination $destinationBinFolder
Remove-Item $downloadFolder -Force -Recurse

$Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $False
[System.IO.File]::WriteAllLines( (Join-Path $destinationFolder "version.json"), (ConvertTo-Json $option -Compress -Depth 100), $Utf8NoBomEncoding)
