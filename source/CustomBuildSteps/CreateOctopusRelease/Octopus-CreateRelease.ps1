param(
	[string] [Parameter(Mandatory = $true)]
	$ConnectedServiceName,
	[string] [Parameter(Mandatory = $true)]
	$ProjectName,
	[string] [Parameter(Mandatory = $false)]
	$ChangesetCommentReleaseNotes,
	[string] [Parameter(Mandatory = $false)]
	$WorkItemReleaseNotes,
	[string] [Parameter(Mandatory = $false)]
	$DeployTo,
	[string] [Parameter(Mandatory = $false)]
	$AdditionalArguments
)

#todo:
#  - handle non-TFVC repositories

Write-Verbose "Entering script Octopus-CreateRelease.ps1"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"


# Get release notes from linked changesets and work items
function Get-LinkedReleaseNotes($vssEndpoint, $comments, $workItems) {
	$personalAccessToken = $vssEndpoint.Authorization.Parameters.AccessToken
	
	$changesUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$($env:SYSTEM_TEAMPROJECTID)/_apis/build/builds/$($env:BUILD_BUILDID)/changes"
	$headers = @{Authorization = "Bearer $personalAccessToken"}
	$relatedChanges = (Invoke-WebRequest -Uri $changesUri -Headers $headers -UseBasicParsing).Content | ConvertFrom-Json
	Write-Host "Related Changes = $relatedChanges"
	
	$releaseNotes = ""
	$nl = "`r`n`r`n"
    Write-Host $env:BUILD_REPOSITORY_PROVIDER
	if ($comments -eq $true) {
		if ($env:BUILD_REPOSITORY_PROVIDER -eq "Tfvc" -or $env:BUILD_REPOSITORY_PROVIDER -eq "TfsVersionControl") {
			Write-Host "Adding changeset comments to release notes"
			$releaseNotes += "**Changeset Comments:**$nl"
			$relatedChanges.value | ForEach-Object {$releaseNotes += "* [$($_.id) - $($_.author.displayName)]($(ChangesetUrl $_.location)): $($_.message)$nl"}
		} elseif ($env:BUILD_REPOSITORY_PROVIDER -eq "TfsGit") {
			Write-Host "Adding commit messages to release notes"
			$releaseNotes += "**Commit Messages:**$nl"
			$relatedChanges.value | ForEach-Object {$releaseNotes += "* [$($_.id) - $($_.author.displayName)]($(CommitUrl $_)): $($_.message)$nl"}
		}
	}
	
	if ($workItems -eq $true) {
		Write-Host "Adding work items to release notes"
		$releaseNotes += "**Work Items:**$nl"
		if ($env:BUILD_REPOSITORY_PROVIDER -eq "Tfvc") {
			foreach ($c in $relatedChanges.value) {
				# work item id is a hack because id is prefixed with "C", and I'm not 100% sure it's consistent.
				$wiId = $c.location.Substring($c.location.LastIndexOf("/")+1)
				$wiUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)/_apis/tfvc/changesets/$wiId/workItems"
				$wi = (Invoke-WebRequest -Uri $wiUri -Headers $headers -UseBasicParsing) | ConvertFrom-Json
				$wi.value | ForEach-Object {$releaseNotes += "* [$($_.id)]($($_.webUrl)): $($_.title) [$($_.state)]$nl"}
			}
		} elseif ($env:BUILD_REPOSITORY_PROVIDER -eq "TfsGit") {
			$relatedWorkItemsUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$($env:SYSTEM_TEAMPROJECTID)/_apis/build/builds/$($env:BUILD_BUILDID)/workitems?api-version=2.0"
			Write-Host "Performing POST request to $relatedWorkItemsUri"
			$relatedWorkItems = (Invoke-WebRequest -Uri $relatedWorkItemsUri -Method POST -Headers $headers -UseBasicParsing -ContentType "application/json") | ConvertFrom-Json
			
			Write-Host "Retrieved $($relatedWorkItems.count) work items"
			if ($relatedWorkItems.count -gt 0) {
				$workItemsUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)/_apis/wit/workItems?ids=$(($relatedWorkItems.value.id) -join '%2C')"
				Write-Host "Performing GET request to $workItemsUri"
				$workItemsDetails = (Invoke-WebRequest -Uri $workItemsUri -Headers $headers -UseBasicParsing) | ConvertFrom-Json
			
				$workItemEditBaseUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$($env:SYSTEM_TEAMPROJECTID)/_workitems/edit"
				$workItemsDetails.value | ForEach-Object {$releaseNotes += "* [$($_.id)]($workItemEditBaseUri/$($_.id)): $($_.fields.'System.Title') [$($_.fields.'System.State')]$nl"}
			}
		}
	}
	
	return $releaseNotes
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


# Returns the Octo.exe parameters for credentials
function Get-OctoCredentialParameters($serviceDetails) {
	$pwd = $serviceDetails.Authorization.Parameters.Password
	if ($pwd.StartsWith("API-")) {
        return "--apiKey=$pwd"
    } else {
        $un = $serviceDetails.Authorization.Parameters.Username
        return "--user=$un --pass=$pwd"
    }
}



# Returns a path to the Octo.exe file
function Get-PathToOctoExe() {
	$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.ScriptBlock.File
	$targetPath = Join-Path -Path $PSScriptRoot -ChildPath "Octo.exe" 
	return $targetPath
}



# Create a Release Notes file for Octopus
function Create-ReleaseNotes($linkedItemReleaseNotes) {
	$buildNumber = $env:BUILD_BUILDNUMBER #works
	$buildId = $env:BUILD_BUILDID #works
	$projectName = $env:SYSTEM_TEAMPROJECT	#works
	#$buildUri = $env:BUILD_BUILDURI #works but is a vstfs:/// link
	#Note: This URL will undoubtedly change in the future
	$buildUri = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$projectName/_BuildvNext#_a=summary&buildId=$buildId"
	$buildName = $env:BUILD_DEFINITIONNAME	#works
	$repoName = $env:BUILD_REPOSITORY_NAME	#works
	#$repoUri = $env:BUILD_REPOSITORY_URI #nope :(
	$notes = "Release created by Build [${buildName} #${buildNumber}](${buildUri}) in Project ${projectName} from the ${repoName} repository."
	if (-not [System.String]::IsNullOrWhiteSpace($linkedItemReleaseNotes)) {
		$notes += "`r`n`r`n$linkedItemReleaseNotes"
	}
	$fileguid = [guid]::NewGuid()
	$fileLocation = Join-Path -Path $env:BUILD_STAGINGDIRECTORY -ChildPath "release-notes-$fileguid.md"
	$notes | Out-File $fileLocation -Encoding utf8
	
	return "--releaseNotesFile=`"$fileLocation`""
}


### Execution starts here ###

# Get required parameters
$connectedServiceDetails = Get-ServiceEndpoint -Name "$ConnectedServiceName" -Context $distributedTaskContext 
$credentialParams = Get-OctoCredentialParameters($connectedServiceDetails)
$octopusUrl = $connectedServiceDetails.Url

# Get release notes
$linkedReleaseNotes = ""
$wiReleaseNotes = Convert-String $WorkItemReleaseNotes Boolean
$commentReleaseNotes = Convert-String $ChangesetCommentReleaseNotes Boolean
if ($wiReleaseNotes -or $commentReleaseNotes) {
	$vssEndPoint = Get-ServiceEndPoint -Name "SystemVssConnection" -Context $distributedTaskContext
	$linkedReleaseNotes = Get-LinkedReleaseNotes $vssEndPoint $commentReleaseNotes $wiReleaseNotes
}
$releaseNotesParam = Create-ReleaseNotes $linkedReleaseNotes

#deployment arguments
if (-not [System.String]::IsNullOrWhiteSpace($DeployTo)) {
	$deployToParams = "--deployTo=`"$DeployTo`""
}

# Call Octo.exe
$octoPath = Get-PathToOctoExe
Write-Output "Path to Octo.exe = $octoPath"
Invoke-Tool -Path $octoPath -Arguments "create-release --project=`"$ProjectName`" --server=$octopusUrl $credentialParams $deployToParams $releaseNotesParam $AdditionalArguments"

Write-Verbose "Finishing Octopus-CreateRelease.ps1"