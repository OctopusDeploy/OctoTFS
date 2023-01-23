import { getLineSeparatedItems, getOverwriteModeFromReplaceInput, getRequiredInput } from "../../Utils/inputs";
import * as tasks from "azure-pipelines-task-lib";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import { BuildInformation } from "./buildInformation";
import { getOctopusCliTool } from "../../Utils/tool";

const space = getRequiredInput("Space");
const packageIds = getLineSeparatedItems(tasks.getInput("PackageId", true) || "");
const packageVersion = tasks.getInput("PackageVersion", true) || "";
const overwriteMode = getOverwriteModeFromReplaceInput(tasks.getInput("Replace", true) || "");
const additionalArguments = tasks.getInput("AdditionalArguments");

const connection = getDefaultOctopusConnectionDetailsOrThrow();

new BuildInformation(getOctopusCliTool(), connection).run(space, packageIds, packageVersion, overwriteMode, additionalArguments);
