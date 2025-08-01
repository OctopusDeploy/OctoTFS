import { Logger } from "@octopusdeploy/api-client";
import { getDefaultOctopusConnectionDetailsOrThrow } from "tasks/Utils/connection";
import * as tasks from "azure-pipelines-task-lib/task";
import { ConcreteTaskWrapper, TaskWrapper } from "tasks/Utils/taskInput";
import { BuildInformation } from "./buildInformation";
import { IVstsHelper, VstsHelper } from "./vsts";

const connection = getDefaultOctopusConnectionDetailsOrThrow();

const logger: Logger = {
    debug: (message) => {
        tasks.debug(message);
    },
    info: (message) => console.log(message),
    warn: (message) => tasks.warning(message),
    error: (message, err) => {
        if (err !== undefined) {
            tasks.error(err.message);
        } else {
            tasks.error(message);
        }
    },
};

const task: TaskWrapper = new ConcreteTaskWrapper();
const vsts: IVstsHelper = new VstsHelper(logger);

new BuildInformation(connection, logger, task, vsts).run();
