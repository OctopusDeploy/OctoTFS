[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

try {

    . .\Octopus-VSTS.ps1

    $IgnorePullRequestMergeBuilds = Get-VstsInput -Name IgnorePullRequestMergeBuilds -AsBool
    $OctoConnectedServiceName = Get-VstsInput -Name OctoConnectedServiceName
    $ConnectedServiceName = Get-VstsInput -Name ConnectedServiceName
    $Packages = Get-VstsInput -Name Package -Require
    $AdditionalArguments = Get-VstsInput -Name AdditionalArguments
    $Replace = Get-VstsInput -Name Replace -AsBool

    if( $IgnorePullRequestMergeBuilds -and ${env:BUILD_SOURCEBRANCH} -match "^refs/pull/.*/merge$")
    {
        Write-Output "Skipping push step - Pull Request build detected (branch name: ${env:BUILD_SOURCEBRANCH})"
        return
    }

    # Get required parameters
	if ([System.String]::IsNullOrWhiteSpace($OctoConnectedServiceName) -and [System.String]::IsNullOrWhiteSpace($ConnectedServiceName)) {
		throw "No Service Endpoint has been specified. You must provide either a Generic or an Octopus Endpoint."
	}
	if (-not [System.String]::IsNullOrWhiteSpace($OctoConnectedServiceName)) {
		$connectedServiceDetails = Get-VstsEndpoint -Name "$OctoConnectedServiceName" -Require
		$credentialParams = Get-OctoCredentialArgsForOctoConnection($connectedServiceDetails)
	} else {
		$connectedServiceDetails = Get-VstsEndpoint -Name "$ConnectedServiceName" -Require
		$credentialParams = Get-OctoCredentialArgs($connectedServiceDetails)
        Write-Warning "You're currently using a Generic Service Endpoint to connect to Octopus Deploy. This Endpoint Type will be deprecated in Octopus Deploy tasks in the future. We strongly recommend updating to the new Octopus Deploy Service Endpoint type."
	}
    $octopusUrl = $connectedServiceDetails.Url

    # Call Octo.exe
    $octoPath = Get-OctoExePath
    $Arguments = "push --server=$octopusUrl $credentialParams $AdditionalArguments"

    ForEach($Package in ($Packages.Split("`r`n|`r|`n").Trim())) {
        if (-not [string]::IsNullOrEmpty($Package)) {

            foreach ($file in (Get-Item -Path $Package)){
                $Arguments = $Arguments + " --package=`"$file`""
            }
        }
    }

    if ($Replace) {
        $Arguments = $Arguments + " --replace-existing"
    }

    Invoke-VstsTool -FileName $octoPath -Arguments $Arguments -RequireExitCodeZero

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
