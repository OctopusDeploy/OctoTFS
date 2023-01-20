import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import { ConcreteTaskWrapper, TaskWrapper } from "tasks/Utils/taskInput";
import { Logger } from "@octopusdeploy/api-client";
import * as tasks from "azure-pipelines-task-lib/task";
import { RunbookRun } from "./runbookRun";

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

new RunbookRun(connection, task, logger).run();
