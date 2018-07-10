[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

try {

    . .\Octopus-VSTS.ps1

    $OctoConnectedServiceName = Get-VstsInput -Name OctoConnectedServiceName -Require
    $Project = Get-VstsInput -Name Project -Require
    $From = Get-VstsInput -Name From -Require
    $To = Get-VstsInput -Name To -Require
    $ShowProgress = Get-VstsInput -Name ShowProgress -AsBool
    $DeployForTenants = Get-VstsInput -Name DeployForTenants
	$DeployForTenantTags = Get-VstsInput -Name DeployForTenantTags
    $AdditionalArguments = Get-VstsInput -Name AdditionalArguments

    # Get required parameters
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
    $Arguments = "`"$octoPath`" promote-release --project=`"$ProjectName`" --from=`"$From`" --server=$octopusUrl $credentialParams $AdditionalArguments"

    if ($ShowProgress) {
       $Arguments += " --progress"
    }

    if ($To) {
        ForEach($Environment in $To.Split(',').Trim()) {
            $Arguments = $Arguments + " --to=`"$Environment`""
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
