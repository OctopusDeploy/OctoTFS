This extension provides Build and Release tasks to integrate with [Octopus Deploy](https://octopus.com), as well as a dashboard widget to show the status of a deployment in Octopus.

[Octopus Deploy](https://octopus.com) is great for deploying ASP.NET or .NET Core applications running on IIS or Azure, Windows services, SQL databases, and much, much more.

The [Azure Devops guides](https://g.octopushq.com/GuidesAzureDevops) provide step by step instructions for deploying applications to Octopus from Azure Devops.

<div style="border:1px solid #888;background-color: #ffc;color:#444;padding:5px;">Note: This extension is only compatible with Azure DevOps, Team Foundation Server (TFS) 2017 Update 2 and above, and Visual Studio Team Services (VSTS).<br/><br/>There is an alternative extension compatible with TFS 2015 Update 2 and above. See <a href="https://g.octopushq.com/TFS-VSTS-compat">the Octopus Documentation</a> for extension compatibility details and a download link.
</div>

## Requirements

You will need a minimum build agent version of `2.115.0` with .NET Core SDK `2.0` or later. When targeting build agents without the SDK, you can use the **.NET Core SDK Installer** task to install it. Generally the Hosted Linux, Mac and Hosted VS2017 agent queues already provide it, however please refer to Microsoft documentation regarding what capabilities are provided by which hosted agent pools.

## Add Octopus CLI tool

The Octopus tasks require the Octopus CLI tool, which can be supplied any of the following ways:

* Add the **Octopus CLI installer** task to the build pipeline, before other Octopus tasks. Specific a version number like `8.0.0`, that version will be downloaded and supplied to the other tasks.
* Update the system `PATH` environment variable to include a folder containing the Octopus CLI, on all systems running VSTS agents. You will need to restart the `VSTS Agent` service (or the whole system) for the change to take effect.

## Add a service connection to Octopus Deploy

Before adding any Build or Release tasks to your process, configure an "Octopus Deploy" service connection in the **Project Settings** under **Service connections**.

You'll need an API Key for a user that has sufficient permissions for the tasks you want to perform in your build and release process.
For example, if your build needs to create a Release for Project A, the user who owns that API key will need ReleaseCreate role either unscoped or scoped to Project A.

![Service Connection](img/service-connection.png)

<hr />

## Tasks and Widgets

This extension adds the following tasks:

- Octopus CLI Installer
- Push Package(s) to Octopus
- Push Package Build Information to Octopus
- Create Octopus Release
- Deploy Octopus Release
- Promote Octopus Release
- Invoke Octopus CLI command

And the following widget:

- Octopus Deploy Status

<hr />

## <a name="tools-installer"></a>![Installer Icon](img/octopus_installer.png) Octopus CLI Installer

Optional. Use this task to supply the Octopus CLI tool to other tasks, by downloading them or using a built-in copy.

Alternatively, you can supply the tool using the system `PATH` environment variable, or allow the other tasks to download the latest version themselves. For more information, see [Add Octopus CLI tool](#add-octo-command-line-tool) above.

 Options include:

 * **Octopus CLI Version**: Specific a version number like `8.0.0`, that version will be downloaded and supplied to the other tasks.
 
## <a name="push-packages-to-octopus"></a>![Push Package Icon](img/octopus_push-01.png) Push Packages to Octopus

 ![Configure Push Application Step](img/push-packages-options.png)

 Options include:

 * **Octopus Deploy Server**: The Octopus Server (click **New** to [add a service connection](#Add-a-service-connection-to-Octopus-Deploy)).
 * **Space**: The Octopus space to push a package to.
 * **Package**: Package file to push. To push multiple packages, enter multiple lines.
 * **Replace Existing**: If the package already exists in the repository, the default behavior is to reject the new package being pushed. Set this flag to **True** to overwrite the existing package.
 * **Additional Arguments**: Any additional [Octopus CLI arguments](https://g.octopushq.com/OctopusCliPush) to include.

## <a name="push-package-build-information-to-octopus"></a>![Push Package Icon](img/octopus_push-01.png) Push Package Build Information to Octopus

 ![Configure Push Package Build Information Step](img/push-metadata-options.png)

 Options include:

 * **Octopus Deploy Server**: The Octopus Server (click **New** to [add a service connection](#Add-a-service-connection-to-Octopus-Deploy)).
 * **Space**: The Octopus space to push package build information to.
 * **Package ID**: The ID of the package, pushed separately, to push build information onto. e.g. MyCompany.App
 * **Package Version**: The version of the package, pushed separately, to push build information onto.
 * **Work Items Source**: The service hosting any work items or issues associated with each version of the package. Octopus will add information about the work items or issues to the package build information, which can be used in release notes. For more information see the [Issue Trackers documentation](https://g.octopushq.com/IssueTracking).
 * **Replace Existing**: If the package build information already exists in the repository, the default behavior is to reject the new build information being pushed. Set this flag to 'True' to overwrite the existing package build information.
 * **Additional Arguments**: Any additional [Octopus CLI arguments](https://g.octopushq.com/OctopusCliBuildInformation) to include.

## <a name="create-octopus-release"></a>![Create Release Icon](img/octopus_create-release-04.png) Create Octopus Release

 ![Configure Create Release Step](img/create-release-options.png)

 Options include:

 * **Octopus Deploy Server**: The Octopus Server (click **New** to [add a service connection](#Add-a-service-connection-to-Octopus-Deploy)).
 * **Space**: The Octopus space to create a release in.
 * **Project**: The Octopus project to create a release for.
 * **Release Number**: Release number for the new release (leave blank to let Octopus decide).
 * **Channel**: Channel to use for the new release.
 * **Release Notes**: Any static release notes to be included in the Octopus release.
 * **Deployment** section:
   * **To Environment**:  Optional environment to deploy to after release creation.
   * **Show Deployment Progress**: Whether to wait for the operation to finish, recording output in the log. When enabled, the task only succeeds if the operation finished successfully.
 * **Tenants** section:
   * **Tenant(s)**: Comma-separated list of tenants to deploy to. Note that if completed, this will be treated as a [Tenanted Deployment](https://g.octopushq.com/MultiTenantDeployments) by Octopus.
   * **Tenant tag(s)**: Comma-separated list of tenant tags matching tenants to deploy to. Note that if completed, this will be treated as a [Tenanted Deployment](https://g.octopushq.com/MultiTenantDeployments) by Octopus.
 * **Additional Arguments**:  Any additional [Octopus CLI arguments](https://g.octopushq.com/OctoExeCreateRelease) to include.

### <a name="deploy-octopus-release"></a>![Deploy Release Image](img/octopus_deploy-02.png) Deploy Octopus Release

 ![Configure Deploy Release Step](img/deploy-release-options.png)

 Options include:

 * **Octopus Deploy Server**: The Octopus Server (click **New** to [add a service connection](#Add-a-service-connection-to-Octopus-Deploy)).
 * **Space**: The Octopus space the release is in.
 * **Project**: The Octopus project to deploy.
 * **Release Number**: Release number for the new release (defaults to `latest`).
 * **Deploy to Environments**: Comma-separated list of environments to deploy to.
 * **Show Deployment Progress**: Whether to wait for the operation to finish, recording output in the log. When enabled, the task only succeeds if the operation finished successfully.
 * **Tenants** section:
   * **Tenant(s)**: Comma-separated list of tenants to deploy to. Note that if completed, this will be treated as a [Tenanted Deployment](https://g.octopushq.com/MultiTenantDeployments) by Octopus.
   * **Tenant tag(s)**: Comma-separated list of tenant tags matching tenants to deploy to. Note that if completed, this will be treated as a [Tenanted Deployment](https://g.octopushq.com/MultiTenantDeployments) by Octopus.
 * **Additional Arguments**:  Any additional [Octopus CLI arguments](https://g.octopushq.com/OctopusCliDeployRelease) to include.

### <a name="promote-octopus-release"></a>![Promote Release Image](img/octopus_promote-05.png) Promote Octopus Release

![Configure Promote Release Step](img/promote-release-options.png)

Options include:
 * **Octopus Deploy Server**: The Octopus Server (click **New** to [add a service connection](#Add-a-service-connection-to-Octopus-Deploy)).
 * **Space**: The Octopus space the release is in.
 * **Project**: The Octopus project to deploy.
 * **Promote From**: The environment to promote a deployment from.
 * **Promote To**: The environment to promote a deployment to.
 * **Show Deployment Progress**: Whether to wait for the operation to finish, recording output in the log. When enabled, the task only succeeds if the operation finished successfully.
 * **Tenants** section:
   * **Tenant(s)**: Comma-separated list of tenants to deploy to. Note that if completed, this will be treated as a [Tenanted Deployment](https://g.octopushq.com/MultiTenantDeployments) by Octopus.
   * **Tenant tag(s)**: Comma-separated list of tenant tags matching tenants to deploy to. Note that if completed, this will be treated as a [Tenanted Deployment](https://g.octopushq.com/MultiTenantDeployments) by Octopus.
 * **Additional Arguments**:  Any additional [Octopus CLI arguments](https://g.octopushq.com/OctopusCliPromoteRelease) to include.

<hr/>

### <a name="octopus-status-widget"></a>![Octopus Deploy Status Widget](img/widget-icon.jpg) Octopus Deploy Status Widget

![Multiple Widgets on Dashboard](img/multiple-widget-preview.jpg)

Each instance of this widget displays the status of an Octopus project in one environment.

Configuration settings:
 * **Size**: Either a 1x1 or a 2x1 widget size.
 * **Octopus Connection**: The Octopus Server (available once you [add a service connection](#Add-a-service-connection-to-Octopus-Deploy)).
 * **Space**: The Octopus space the project is in.
 * **Octopus Project**: The Octopus project to display.
 * **Environment**: The Octopus environment to display status in.

Clicking on the widget will open the deployment log for the displayed task in Octopus.

**Note:** The widget will only be populated when a deployment of the specified project to the specified environment has occurred.
