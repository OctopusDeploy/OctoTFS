# Returns a path to the Octo.exe file
function Get-OctoExePath() {
    return Join-Path $PSScriptRoot "Octo.dll"
}

# Returns the Octo.exe arguments for credentials
function Get-OctoCredentialArgs($serviceDetails) {
	$pwd = $serviceDetails.Auth.Parameters.Password
	if ($pwd.StartsWith("API-")) {
        return "--apiKey=""$pwd"""
    } else {
        $un = $serviceDetails.Auth.Parameters.Username
        return "--user=""$un"" --pass=""$pwd"""
    }
}

# Returns the Octo.exe arguments for credentials from an Octopus-specific endpoint connection
function Get-OctoCredentialArgsForOctoConnection($serviceDetails) {
    $apikey = $serviceDetails.Auth.Parameters.apitoken
    return "--apiKey=""$apiKey"""
}

# Returns the raw API key from the credentials
function Get-OctoApiKey($serviceDetails) {
    $apiKey = $serviceDetails.Auth.Parameters.apitoken
    if ([System.String]::IsNullOrWhiteSpace($apiKey)) {
        $apiKey = $serviceDetails.Auth.Parameters.Password
    }
    return $apiKey
}

# Returns the project Name from the project Id
function Get-ProjectNameFromId($serviceDetails, $projectId) {
    $octoUrl = $serviceDetails.Url
    $apiKey = Get-OctoApiKey($serviceDetails)
    $headers = @{"X-Octopus-ApiKey" = $apiKey}
    $projectDetails = Invoke-RestMethod -Method Get -Uri "$octoUrl/api/projects/$projectId" -Headers $headers
    return $projectDetails.Name
}