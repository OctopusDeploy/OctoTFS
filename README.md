# OctoTFS

OctoTFS is a set of packaging and release tasks and a widget for using Octopus Deploy with Azure DevOps and Team Foundation Server (TFS).

> Azure DevOps was formerly known as Visual Studio Team Services (VSTS) and Visual Studio Online (VSO).

OctoTFS is made up of several tasks to make it easy to integrate TFS and ADO with Octopus Deploy. This is packaged up as a web extension that can be installed in TFS or ADO.

## TFS / Azure DevOps Web Extension Custom Tasks

To learn more about how to use the extension and custom tasks, read the [VSTS README](source/vsts.md).

* [Push Package(s) to Octopus](source/tasks/Push)
* [Push Package Build Information to Octopus](source/tasks/BuildInformation)
* [Create Octopus Release](source/tasks/CreateOctopusRelease)
* [Deploy Octopus Release](source/tasks/Deploy)
* [Promote Octopus Release](source/tasks/Promote)

This extension provides a friendly interface to the [Octopus CLI](https://g.octopushq.com/ExternalToolOctoTools) which does the heavy lifting to integrate.

## Dev

Microsoft TFS/ADO web extensions are powered by Node.js under the hood. Simply open the repo with your favourite text editor like [Jetbrains WebStorm](https://jetbrains.com/webstorm) or [Visual Studio Code](https://code.visualstudio.com/) and you're good to go.

## Building

### Prerequisites

* Node.js 10.15.3 (LTS) (`choco install nodejs` or `brew install node@10` or [web](https://nodejs.org))
* NPM: 5.6.0+ (`npm install npm@latest -g`)
* TFX (`npm install tfx-cli -g`)
* Install golang (`choco install golang` or `brew install go` or [web](https://golang.org))
* Node-Prune (`go get github.com/tj/node-prune`)
* PowerShell (`choco install powershell-core` or `brew cask install powershell` or web (google it...))

NOTE: PowerShell is required if you intend to publish the extension either to a local TFS instance or otherwise.

### How to build and package the extension

Microsoft's web extension tooling is cross platform so you can run this on Windows or macOS.

**Build**

Run the following at a commandline.

* `npm install --no-save`
* `npm run build`

This will generate the full extension content required to create the extension VSIX.

**Packaging**

In order to package and test the extension on a local TFS instance, without publishing to the marketplace, you can run the following at a PowerShell command prompt.

`./pack.ps1 -environment localtest -version "x.x.x"`

### Releasing

To create a new release:

-   Merge your changes PR to main
-   Check the `PACKAGE_VERSION` variable value in the build.yml. Bump the major/minor as appropriate for the changes being released (this will require another branch/PR because of RBAC). :warning: DO NOT bump these numbers prior to the release going out, branch builds can impact each other if they do this because the marketplace enforces forward only on version numbers and it is imperative that all currently active branches use the same major.minor values.
-   Work out what the next run number in GitHub is going to be. Create a release and tag with the version based on `PACKAGE_VERSION` and the run number, remembering to prefix the release with a `v`. The pipeline will automate things from once the GitHub release is created.

### How to test the extension

If you're doing updates, enhancements, or bug fixes, the fastest development flow is to code locally, build, package and deploy locally. Once your changes are stable, it's a good idea to deploy to Test for further testing, and finally Production.

### Local

It's highly recommended to set up two Virtual Machines running Windows Server. This is generally done locally, and it's best to give your VM at least 8 gigs of memory and 4 CPU cores, otherwise the TFS/ADO installation can fail or take hours.

1. Microsoft TFS Server 2017 Update 1 - This is the first version of TFS that supported extensions, so it's very good for regression testing.
2. Microsoft Azure DevOps Server vLatest - This is the on-prem version of Microsoft's hosted Azure DevOps services/tooling. It's generally faster/easier to test this locally than continually publishing to the Azure DevOps Marketplace.

To install locally, build and package the application as per the instructions above. Then install the extension by uploading it. Instructions to do this are available in Microsoft's [TFS/ADO docs](https://docs.microsoft.com/en-us/vsts/marketplace/get-tfs-extensions?view=tfs-2018#install-extensions-for-disconnected-tfs).

#### Additional tips

* TFS/ADO is accessible on port 8080 by default (this can be changed if desired) at something like the following: `http://<server name/ip>:8080/tfs/`
* The TFS/ADO "Manage Extensions" page, where you upload test extensions, is available at `http://<server name/ip>:8080/tfs/_gallery/manage`
* You may need to tweak your VM firewall settings to access it from outside of your VM in the host OS. Assuming it's local, turning it off is pretty quick and safe.

#### Testing Gotchas

* If you design a build pipeline with the current live extension, you can't upgrade it to a local version. You need to install the `localtest` extension first and use it in your builds. Then you can upgrade it and you will get your latest changes.
* We need to maintain backwards compatibility, and we need to ensure any existing builds will not break after we publish an update. Therefore regression testing is critical. The recommended approach for regression testing is to build the current live extension for `localtest` and create build pipelines covering the areas you're changing. Then update the extension and re-run all your builds to ensure everything is still green/working.
* Building on the previous point, there is no way to roll back an extension so testing is difficult as well. The recommended approach to this is to snapshot your local test VMs when you have a working build, so you can update the extension and revert back to the snapshot as needed.
* During manual testing against our test environment on Azure DevOps, the `devops@...` account has access for publishing to test and production environments (if you try to do this from your personal account, publishing will fail). When you create your security tokens, do this from the devops account and either setup an expiry and/or remove the token when you are finished with it.
* At the time of writing, we have a [build pipeline on ADO](https://octopus-deploy.visualstudio.com/VstsExtension/_build?definitionId=5&_a=summary), which builds and pushes packages to our [deployhq](https://deploy.octopushq.com/app#/Spaces-1/projects/azure-devops-extension/deployments) project, where we can then release to Test and Production.
* If the deployHQ task fails due to a timeout (which is common), trying again on the octopusHQ task *will not fix it*. You need to squirrel into the VSTS task (see the task log in octopusHQ, it will have a link to the VSTS task in the log, which will have a link to the `Web`, click that and it'll take you to the problem), see that it's failing on all the steps related to v4 of our octo tool, *run the same task again (as new)* (don't re-run the existing task that's failed), wait for that to succeed, then re-run our task in deployHQ and it will then succeed. We want to allocate time to investigate why this is so awkward, but for now, we're documenting here for discoverability.

### Test environment

Octopus staff can publish an extension for testing which is wired up to a test Azure DevOps organization. This is a great area for further live testing against the latest and greatest release of Azure DevOps.

- [Octopus Extension in Marketplace](https://marketplace.visualstudio.com/items?itemName=octopusdeploy.octopus-deploy-build-release-tasks-test)
- [Octopus VSTS Environment](https://octopus-deploy-test.visualstudio.com)
- [Security Tokens](https://octopus-deploy-test.visualstudio.com/_details/security/tokens)

NOTE: See the [OctopusHQ Confluence](https://octopushq.atlassian.net/wiki/spaces/IN/pages/60063746/VSTS+Test+Environment) for further details on gaining access to the Azure DevOps (aka VSTS) test environment.

### Production environment

Octopus staff can publish an extension for production use.

- [Octopus Extension in Marketplace](https://marketplace.visualstudio.com/items?itemName=octopusdeploy.octopus-deploy-build-release-tasks)
- [Octopus VSTS Environment](https://octopus-deploy.visualstudio.com)
- [Security Tokens](https://octopus-deploy.visualstudio.com/_details/security/tokens)

NOTE: See the [OctopusHQ Confluence](https://octopushq.atlassian.net/wiki/spaces/IN/pages/60063746/VSTS+Test+Environment) for further details on gaining access to the Azure DevOps (aka VSTS) production/live environment.

## Other Useful Links

- [Marketplace Publishing Portal (octopusdeploy)](https://marketplace.visualstudio.com/manage/publishers/octopusdeploy)
