param(
	[string] [Parameter(Mandatory = $true)]
	$packageId,
	[string] [Parameter(Mandatory = $true)]
	$packageVersion,
	[string] [Parameter(Mandatory = $true)]
	$directoryToFind,    
	[string] [Parameter(Mandatory = $true)]
	$packageType,
	[string] [Parameter(Mandatory = $true)]
	$additionalOctopackArguments,
	[string] [Parameter(Mandatory = $false)]
	$WorkItemReleaseNotes,
	[string] [Parameter(Mandatory = $false)]
	$ChangesetCommentReleaseNotes,
	[string] [Parameter(Mandatory = $false)]
	$CustomReleaseNotes,
	[string] [Parameter(Mandatory = $false)]
	$pushPackage,
	[string] [Parameter(Mandatory = $false)]
	$connectedServiceName
)

Write-Verbose "Entering script Octopus-CreatePackage.ps1"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

# Get release notes from linked changesets and work items
function Get-LinkedReleaseNotes($vssEndpoint, $comments, $workItems) {

    Write-Host "Environment = $env:BUILD_REPOSITORY_PROVIDER"
	Write-Host "Comments = $comments, WorkItems = $workItems"
	$personalAccessToken = $vssEndpoint.Authorization.Parameters.AccessToken
	
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


# Returns directory containing files to package
function Get-DirectoryToPackage($baseDirectory, $directoryToFind) {
	Write-Host "Looking for directory $directoryToFind in $baseDirectory"
	
	$publishDirectory
	$items = Get-ChildItem -Path $baseDirectory -Filter $directoryToFind -rec | where {$_.PSIsContainer -eq $true}

	if ($items.Count -eq 0) {
		Write-Error "No directories matching `"$directoryToFind`" found in `"$baseDirectory`""
		Exit
	}
 
	# enumerate the items array
	foreach ($item in $items) {

		$directoryName = $item.FullName
	
		Write-Host "Analyzing directory `"$directoryName`""

		if ($item.FullName -eq "Release\$directoryToFind") {
	
			Write-Host "Directory `"$directoryName`" identified as a match"

			$publishDirectory = $item
			break
		}
	}

	if (!$publishDirectory) {
		foreach ($item in $items) {
			if ($item.FullName -like "*$directoryToFind*") {
				$publishDirectory = $item
				break
			}
		}
	}

	if (!$publishDirectory) {
		Write-Error "No matching directories found in $baseDirectory"
		Exit
	}

	if ($directoryToFind -eq "_PublishedWebsites") {
		
		$childDirectories = $publishDirectory.GetDirectories()
		if ($childDirectories.count -eq 0) {
			$publishDirectoryName = $publishDirectory.FullName
			Write-Error "No directories found within $publishDirectoryName"
			Exit
		} else {
			return $childDirectories[0].FullName
		}
	} else {
		return $publishDirectory[0].FullName
	}
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

$baseDirectory = $Env:BUILD_SOURCESDIRECTORY
	
# Set current working directory
Set-Location $baseDirectory

# Check to see that $directoryToFind has been provided
if ([System.String]::IsNullOrWhiteSpace($directoryToFind)) {
	Write-Error "No directory to find has been provided."
} else {

	if ([System.String]::IsNullOrWhiteSpace($packageVersion)) {
		Write-Error "Unable to get version of package. Please provide in step options or use build number to version package"
	} else {

		$directoryToPackage = Get-DirectoryToPackage $baseDirectory $directoryToFind | Out-String
		$directoryToPackage = $directoryToPackage.Replace("`r`n", "")
		Write-Verbose "Identified $directoryToPackage as directory to be packaged"

		# Get release notes
		$linkedReleaseNotes = ""
		$wiReleaseNotes = [System.Convert]::ToBoolean($WorkItemReleaseNotes)
		$commentReleaseNotes = [System.Convert]::ToBoolean($ChangesetCommentReleaseNotes)
		if ($wiReleaseNotes -or $commentReleaseNotes) {
			$vssEndPoint = Get-ServiceEndPoint -Name "SystemVssConnection" -Context $distributedTaskContext
			$linkedReleaseNotes = Get-LinkedReleaseNotes $vssEndPoint $commentReleaseNotes $wiReleaseNotes
		}
		$releaseNotesParam = Create-ReleaseNotes $linkedReleaseNotes

		# Get path to Octo.exe
		$octoPath = Get-PathToOctoExe
		Write-Verbose "Path to Octo.exe = $octoPath"
		
		$packageName = "$packageId.$packageVersion.$packageType"

		# Call Octo.exe to package code
		$octoPackCommand = "& `"$octoPath`" pack --id=`"$packageId`" --version=$packageVersion --format=$packageType --basePath=`"$directoryToPackage`" --outFolder=`"$baseDirectory`" $releaseNotesParam $additionalOctopackArguments"
		Write-Host "Packing directory `"$directoryToPackage`" as $packageName"
		Write-Verbose "Executing: '$octoPackCommand'"
		Invoke-Expression $octoPackCommand
		
		Write-Verbose "The octo.exe pack command exited with a code of $lastexitcode"
		
		if ($lastexitcode -ne 0) {
			Write-Error "An error was encountered when attempting to create the package"
		} else {
				
			# Call Octo.exe to push package to Octopus
			$callOctoPush = [System.Convert]::ToBoolean($pushPackage)
			if ($callOctoPush) {
				
				# Get Octopus server connection
				$connectedServiceDetails = Get-ServiceEndpoint -Name "$connectedServiceName" -Context $distributedTaskContext 
				$credentialParams = Get-OctoCredentialParameters($connectedServiceDetails)
				$octopusUrl = $connectedServiceDetails.Url
			
				$octoPushCommand = "& `"$octoPath`" push --package=$packageName --server=$octopusUrl $credentialParams --enableServiceMessages"
				Write-Host "Pushing package $packageName to Octopus server at $octopusUrl"
				Write-Verbose "Executing: '$octoPushCommand'"
				Invoke-Expression $octoPushCommand
		
				Write-Verbose "The octo.exe push command exited with a code of $lastexitcode"
				
				if ($lastexitcode -ne 0) {
					Write-Error "An error was encountered when attempting to push the package to the server"
				}
			}
		}
	}
}

Write-Verbose "Finishing Octopus-CreatePackage.ps1"