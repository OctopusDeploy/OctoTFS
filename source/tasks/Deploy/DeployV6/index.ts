//import * as tasks from "azure-pipelines-task-lib/task";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
//import { getDelimitedInput, getRequiredInput } from "../../Utils/inputs";
import { Deploy } from "./deploy";
//import { getOctopusCliTool } from "../../Utils/tool";

// const space = getRequiredInput("Space");
// const project = getRequiredInput("Project");
// const releaseNumber = getRequiredInput("ReleaseNumber");
// const deployToEnvironments = getDelimitedInput("Environments");
// const deployForTenants = getDelimitedInput("DeployForTenants");
// const deployForTenantTags = getDelimitedInput("DeployForTenantTags");
// const deploymentProgress = tasks.getBoolInput("ShowProgress");
// const additionalArguments = tasks.getInput("AdditionalArguments");

const connection = getDefaultOctopusConnectionDetailsOrThrow();

new Deploy(connection).run();
