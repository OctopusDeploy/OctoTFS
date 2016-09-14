[CmdletBinding()]
param()

# Get release notes from linked changesets and work items
function Get-LinkedReleaseNotes($vssEndpoint, $comments, $workItems) {

    Write-Host "Environment = $env:BUILD_REPOSITORY_PROVIDER"
	Write-Host "Comments = $comments, WorkItems = $workItems"
	$personalAccessToken = $vssEndpoint.Auth.Parameters.AccessToken
	
	$changesUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$($env:SYSTEM_TEAMPROJECTID)/_apis/build/builds/$($env:BUILD_BUILDID)/changes"
	$headers = @{Authorization = "Bearer $personalAccessToken"}
	$changesResponse = Invoke-WebRequest -Uri $changesUri -Headers $headers -UseBasicParsing
	$relatedChanges = $changesResponse.Content | ConvertFrom-Json
	Write-Host "Related Changes = $($relatedChanges.value)"
	
	$releaseNotes = ""
	$nl = "`r`n`r`n"
	if ($comments -eq $true) {
		if ($env:BUILD_REPOSITORY_PROVIDER -eq "TfsVersionControl") {
			Write-Host "Adding changeset comments to release notes"
			$releaseNotes += "**Changeset Comments:**$nl"
			$relatedChanges.value | ForEach-Object {$releaseNotes += "* [$($_.id) - $($_.author.displayName)]($(ChangesetUrl $_.location)): $($_.message)$nl"}
		} else {
			Write-Host "Adding commit messages to release notes"
			$releaseNotes += "**Commit Messages:**$nl"
			$relatedChanges.value | ForEach-Object {$releaseNotes += "* [$($_.id) - $($_.author.displayName)]($(CommitUrl $_)): $($_.message)$nl"}
		}
	}
	
	if ($workItems -eq $true) {
		Write-Host "Adding work items to release notes"
		$releaseNotes += "**Work Items:**$nl"

		$relatedWorkItemsUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$($env:SYSTEM_TEAMPROJECTID)/_apis/build/builds/$($env:BUILD_BUILDID)/workitems?api-version=2.0"
		Write-Host "Performing POST request to $relatedWorkItemsUri"
		$relatedWiResponse = Invoke-WebRequest -Uri $relatedWorkItemsUri -Method POST -Headers $headers -UseBasicParsing -ContentType "application/json"
		$relatedWorkItems = $relatedWiResponse.Content | ConvertFrom-Json
		
		Write-Host "Retrieved $($relatedWorkItems.count) work items"
		if ($relatedWorkItems.count -gt 0) {
			$workItemsUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)/_apis/wit/workItems?ids=$(($relatedWorkItems.value.id) -join '%2C')"
			Write-Host "Performing GET request to $workItemsUri"
			$relatedWiDetailsResponse = Invoke-WebRequest -Uri $workItemsUri -Headers $headers -UseBasicParsing
			$workItemsDetails = $relatedWiDetailsResponse.Content | ConvertFrom-Json
		
			$workItemEditBaseUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$($env:SYSTEM_TEAMPROJECTID)/_workitems/edit"
			$workItemsDetails.value | ForEach-Object {$releaseNotes += "* [$($_.id)]($workItemEditBaseUri/$($_.id)): $($_.fields.'System.Title') $(GetWorkItemState($_.fields)) $(GetWorkItemTags($_.fields)) $nl"}
		}
	}
	Write-Host "Release Notes:`r`n$releaseNotes"
	return $releaseNotes
}
function GetWorkItemState($workItemFields) {
    return "<span class='label'>$($workItemFields.'System.State')</span>"
}
function GetWorkItemTags($workItemFields)
{    
    $tagHtml = ""
    if($workItemFields -ne $null -and $workItemFields.'System.Tags' -ne $null )
    {        
        $workItemFields.'System.Tags'.Split(';') | ForEach-Object {$tagHtml += "<span class='label label-info'>$($_)</span>"}
    }
   
    return $tagHtml
}
function ChangesetUrl($apiUrl) {
	$wiId = $apiUrl.Substring($apiUrl.LastIndexOf("/")+1)
	return "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$($env:SYSTEM_TEAMPROJECTID)/_versionControl/changeset/$wiId"
}
function CommitUrl($change) {
	$commitId = $change.id
	$repositoryId = Split-Path (Split-Path (Split-Path $change.location -Parent) -Parent) -Leaf
	return "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$($env:SYSTEM_TEAMPROJECTID)/_git/$repositoryId/commit/$commitId"
}

# Create a Release Notes file for Octopus
function Create-ReleaseNotes($linkedItemReleaseNotes) {
	$buildNumber = $env:BUILD_BUILDNUMBER #works
	$buildId = $env:BUILD_BUILDID #works
	$projectName = $env:SYSTEM_TEAMPROJECT	#works
	#$buildUri = $env:BUILD_BUILDURI #works but is a vstfs:/// link
	#Note: This URL will undoubtedly change in the future
	$buildUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$projectName/_build#_a=summary&buildId=$buildId"
	$buildName = $env:BUILD_DEFINITIONNAME	#works
	$repoName = $env:BUILD_REPOSITORY_NAME	#works
	#$repoUri = $env:BUILD_REPOSITORY_URI #nope :(
	$notes = "Release created by Build [${buildName} #${buildNumber}](${buildUri}) in Project ${projectName} from the ${repoName} repository."
	if (-not [System.String]::IsNullOrWhiteSpace($linkedItemReleaseNotes)) {
		$notes += "`r`n`r`n$linkedItemReleaseNotes"
	}
	
	if(-not [System.String]::IsNullOrWhiteSpace($CustomReleaseNotes)) {
		$notes += "`r`n`r`n**Custom Notes:**"
		$notes += "`r`n`r`n$CustomReleaseNotes"
	}
	
	$fileguid = [guid]::NewGuid()
	$fileLocation = Join-Path -Path $env:SYSTEM_DEFAULTWORKINGDIRECTORY -ChildPath "release-notes-$fileguid.md"
	$notes | Out-File $fileLocation -Encoding utf8
	
	return "--releaseNotesFile=`"$fileLocation`""
}

### Execution starts here ###

Trace-VstsEnteringInvocation $MyInvocation

try {

    . .\Octopus-VSTS.ps1

    $ConnectedServiceName = Get-VstsInput -Name ConnectedServiceName -Require
    $ProjectName = Get-VstsInput -Name ProjectName -Require
    $ReleaseNumber = Get-VstsInput -Name ReleaseNumber
    $Channel = Get-VstsInput -Name Channel
    $ChangesetCommentReleaseNotes = Get-VstsInput -Name ChangesetCommentReleaseNotes -AsBool
    $WorkItemReleaseNotes = Get-VstsInput -Name WorkItemReleaseNotes -AsBool
    $CustomReleaseNotes = Get-VstsInput -Name CustomReleaseNotes
    $DeployToEnvironment = Get-VstsInput -Name DeployToEnvironment
	$DeployForTenants = Get-VstsInput -Name DeployForTenants
	$DeployForTenantTags = Get-VstsInput -Name DeployForTenantTags
    $DeploymentProgress = Get-VstsInput -Name DeploymentProgress -AsBool
    $AdditionalArguments = Get-VstsInput -Name AdditionalArguments

    # Get required parameters
    $connectedServiceDetails = Get-VstsEndpoint -Name "$ConnectedServiceName" -Require
    $credentialParams = Get-OctoCredentialArgs($connectedServiceDetails)
    $octopusUrl = $connectedServiceDetails.Url

    # Get release notes
    $linkedReleaseNotes = ""
    if ($WorkItemReleaseNotes -or $ChangesetCommentReleaseNotes) {
        $vssEndPoint = Get-VstsEndpoint -Name "SystemVssConnection" -Require
        $linkedReleaseNotes = Get-LinkedReleaseNotes $vssEndPoint $ChangesetCommentReleaseNotes $WorkItemReleaseNotes
    }
    $releaseNotesParam = Create-ReleaseNotes $linkedReleaseNotes

    #deployment arguments
    if (-not [System.String]::IsNullOrWhiteSpace($DeployToEnvironment)) {
        $deployToParams = "--deployTo=`"$DeployToEnvironment`""
        if ($DeploymentProgress) {
            $deployToParams += " --progress"
        }
    }

  	# optional deployment tenants & tags
	if (-not [System.String]::IsNullOrWhiteSpace($DeployForTenants)) {
        ForEach($Tenant in $DeployForTenants.Split(',').Trim()) {
            $AdditionalArguments = $AdditionalArguments + " --tenant=`"$Tenant`""
        }
	}

	if (-not [System.String]::IsNullOrWhiteSpace($DeployForTenantTags)) {
        ForEach($Tenant in $DeployForTenantTags.Split(',').Trim()) {
            $AdditionalArguments = $AdditionalArguments + " --tenanttag=`"$Tenant`""
		}
	}

    # Call Octo.exe
    $octoPath = Get-OctoExePath
    Invoke-VstsTool -FileName $octoPath -Arguments "create-release --project=`"$ProjectName`" --releaseNumber=`"$ReleaseNumber`" --channel=`"$Channel`" --server=$octopusUrl $credentialParams --enableServiceMessages $deployToParams $releaseNotesParam $AdditionalArguments" -RequireExitCodeZero

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}


