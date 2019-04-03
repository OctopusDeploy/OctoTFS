# OctoTFS

OctoTFS is a repository containing components for integration with Team Foundation Server and Visual Studio Team Services (VSTS).

> Visual Studio Team Services (VSTS) was formerly known as Visual Studio Online (VSO)

## Manual Building and Testing

Note: Use the project in Octopus to deploy. These steps are only for manual releases, which should be avoided.

```
sudo npm install -g tfx-cli
# Increment version number from the one shown at https://marketplace.visualstudio.com/items?itemName=octopusdeploy.octopus-deploy-build-release-tasks-test&targetId=7b703d9c-2348-4d6d-b8fb-df60fdec5ec4&utm_source=vstsproduct&utm_medium=ExtHubManageList
./pack.ps1 Test 2.0.96
# Get access token from https://octopus-deploy.visualstudio.com/_details/security/tokens. Remember to select "All accessible accounts".
./publish.ps1 Test 2.0.96 wieufvliuwefliquwefliqwevfliqwevfliqweuvfliqwevf
```

## Team Build Preview Custom Steps

Custom Build Steps for [Team Build vNext](http://aka.ms/tfbuild)

For usage, see the [Build Steps Readme](source/VSTSExtensions).

* [Create Octopus Package](source/VSTSExtensions/OctopusBuildAndReleaseTasks/Tasks/Pack)
* [Push Packages to Octopus](source/VSTSExtensions/OctopusBuildAndReleaseTasks/Tasks/Push)
* [Create Octopus Release](source/VSTSExtensions/OctopusBuildAndReleaseTasks/Tasks/CreateOctopusRelease)
* [Deploy Octopus Release](source/VSTSExtensions/OctopusBuildAndReleaseTasks/Tasks/Deploy)
* [Promote Octopus Release](source/VSTSExtensions/OctopusBuildAndReleaseTasks/Tasks/Promote)

## Common Links

- [Marketplace Publishing Portal (octopusdeploy)](https://marketplace.visualstudio.com/manage/publishers/octopusdeploy)

## Production Environment

- [Octopus Extension in Marketplace](https://marketplace.visualstudio.com/items?itemName=octopusdeploy.octopus-deploy-build-release-tasks)
- [Octopus VSTS Environment](https://octopus-deploy.visualstudio.com)
- [Security Tokens](https://octopus-deploy.visualstudio.com/_details/security/tokens)

## Test Environment

- [Octopus Extension in Marketplace](https://marketplace.visualstudio.com/items?itemName=octopusdeploy.octopus-deploy-build-release-tasks-test)
- [Octopus VSTS Environment](https://octopus-deploy-test.visualstudio.com)
- [Security Tokens](https://octopus-deploy-test.visualstudio.com/_details/security/tokens)

### Prerequisites
1. Make sure you have [node.js](https://nodejs.org/en/download/) installed
* Node: 8.11.3 or later (**Note** node installer does not update npm)
* NPM: 5.6.0+ (run `npm install npm@latest -g`)
* Gulp (`npm install gulp -g`)
* TFX (`npm install tfx tfx-cli -g`)
* Install Go (https://golang.org/dl/) 
* Install node-prune (https://github.com/tj/node-prune)
* May also need to install natives - https://github.com/gulpjs/gulp/issues/2246 (`npm install natives@1.1.6`)

If you intend to publish the extension either to a local TFS instance or otherwise you will also need powershell core or powershell installed.

### How to build and package
Run `npm run build` to build which will generate the full extension content required to create the extension VSIX.

In order to package and test the extension on a local TFS instance without publishing to the marketplace you can run `./pack.ps1 -environment localtest -version "x.x.x"`

You can follow the [Microsoft documentation](https://docs.microsoft.com/en-us/vsts/marketplace/get-tfs-extensions?view=tfs-2018#install-extensions-for-disconnected-tfs) on how to install to TFS instance.

### Task dependencies
Although we use webpack to bundle we don't generally include the dependencies as part of the bundle itself. We treat these as external and install the associated modules for the task based on the global dependencies that we have. We
also previously bundled a version of octo tools, however we no longer bundle in favor of using an octo installer task.


