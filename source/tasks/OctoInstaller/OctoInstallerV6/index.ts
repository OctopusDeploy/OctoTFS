import * as tasks from "azure-pipelines-task-lib/task";
import { dirname } from "path";

const version = tasks.getInput("octopusVersion", true) || "";

const octopusCli = await installOctopusCli(version);
const octopusCliDir = dirname(octopusCli);
tasks.addPath(octopusCliDir);
tasks.debug(`Added ${octopusCliDir} to PATH`);
