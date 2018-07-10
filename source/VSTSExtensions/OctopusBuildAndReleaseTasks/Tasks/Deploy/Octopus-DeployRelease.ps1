[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

try {

    . .\Octopus-VSTS.ps1

	$OctoConnectedServiceName = Get-VstsInput -Name OctoConnectedServiceName -Require
    $Project = Get-VstsInput -Name Project -Require
    $ReleaseNumber = Get-VstsInput -Name ReleaseNumber -Require
    $Environments = Get-VstsInput -Name Environments -Require
    $ShowProgress = Get-VstsInput -Name ShowProgress -AsBool
    $DeployForTenants = Get-VstsInput -Name DeployForTenants
	$DeployForTenantTags = Get-VstsInput -Name DeployForTenantTags
    $AdditionalArguments = Get-VstsInput -Name AdditionalArguments

    $connectedServiceDetails = Get-VstsEndpoint -Name "$OctoConnectedServiceName" -Require
	$credentialParams = Get-OctoCredentialArgsForOctoConnection($connectedServiceDetails)
    $octopusUrl = $connectedServiceDetails.Url

    # Get the Project name if we have the Project Id
    if ($Project -match 'Projects-\d*') {
        Write-Verbose "Project Id passed, getting project name"
        $ProjectName = Get-ProjectNameFromId $connectedServiceDetails $Project
        Write-Verbose "Project Name is $ProjectName"
    } else {
        $ProjectName = $Project
    }

    # Call Octo.exe
    $octoPath = Get-OctoExePath
    $Arguments = "`"$octoPath`" deploy-release --project=`"$ProjectName`" --releaseNumber=`"$ReleaseNumber`" --server=$octopusUrl $credentialParams $AdditionalArguments"

    if ($ShowProgress) {
       $Arguments += " --progress"
    }

    if ($Environments) {
        ForEach($Environment in $Environments.Split(',').Trim()) {
            $Arguments = $Arguments + " --deployto=`"$Environment`""
        }
    }

    # optional deployment tenants & tags
	if (-not [System.String]::IsNullOrWhiteSpace($DeployForTenants)) {
        ForEach($Tenant in $DeployForTenants.Split(',').Trim()) {
            $Arguments = $Arguments + " --tenant=`"$Tenant`""
        }
	}

	if (-not [System.String]::IsNullOrWhiteSpace($DeployForTenantTags)) {
        ForEach($Tenant in $DeployForTenantTags.Split(',').Trim()) {
            $Arguments = $Arguments + " --tenanttag=`"$Tenant`""
		}
	}

    Invoke-VstsTool -FileName "dotnet" -Arguments $Arguments -RequireExitCodeZero

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}

