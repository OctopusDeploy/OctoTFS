[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

try {

    . .\Octopus-VSTS.ps1

    $OctoConnectedServiceName = Get-VstsInput -Name OctoConnectedServiceName -Require
    $Packages = Get-VstsInput -Name Package -Require
    $AdditionalArguments = Get-VstsInput -Name AdditionalArguments
    $Replace = Get-VstsInput -Name Replace -AsBool

    # Get required parameters
	$connectedServiceDetails = Get-VstsEndpoint -Name "$OctoConnectedServiceName" -Require
	$credentialParams = Get-OctoCredentialArgsForOctoConnection($connectedServiceDetails)
	$octopusUrl = $connectedServiceDetails.Url

    # Call Octo.exe
    $octoPath = Get-OctoExePath
    $Arguments = "`"$octoPath`" push --server=$octopusUrl $credentialParams $AdditionalArguments"

    ForEach($Package in ($Packages.Split("`r`n|`r|`n").Trim())) {
        if (-not [string]::IsNullOrEmpty($Package)) {

            foreach ($file in (Get-ChildItem -Path $Package -Recurse)){
                $Arguments = $Arguments + " --package=`"$file`""
            }
        }
    }

    if ($Replace) {
        $Arguments = $Arguments + " --replace-existing"
    }

    Invoke-VstsTool -FileName "dotnet" -Arguments $Arguments -RequireExitCodeZero

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
