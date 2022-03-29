import { Client, ClientConfiguration, Repository } from "@octopusdeploy/api-client";
import { CommunicationStyle, NewDeploymentTargetResource, PackageRequirement, RunCondition, StartTrigger, TenantedDeploymentMode } from "@octopusdeploy/message-contracts";
import { RunConditionForAction } from "@octopusdeploy/message-contracts/dist/runConditionForAction";

async function run() {
    const configuration: ClientConfiguration = {
        apiKey: process.env.OCTOPUS_API_KEY,
        apiUri: process.env.OCTOPUS_SERVER,
        autoConnect: true,
    };

    const client = await Client.create(configuration);

    console.log(`Updating cors settings`);
    const systemRepository = await new Repository(client).forSystem();
    const metadata = await systemRepository.settings.getById("webportal");
    await systemRepository.settings.saveValues(metadata, {
        Security: {
            CorsWhitelist: `"http://localhost,${configuration.apiUri}"`,
            ReferrerPolicy: "no-referrer",
            ContentSecurityPolicyEnabled: true,
            HttpStrictTransportSecurityEnabled: false,
            HttpStrictTransportSecurityMaxAge: 31556926,
            XOptions: {
                XFrameOptionAllowFrom: null,
                XFrameOptions: "None",
            },
        },
    });

    const repository = await new Repository(client).forSpace("Spaces-1");

    const groupId = (await repository.projectGroups.list({ take: 1 })).Items[0].Id;
    const lifecycleId = (await repository.lifecycles.list({ take: 1 })).Items[0].Id;
    const projectName = "Test Project";
    console.log(`Creating ${projectName} project`);
    const project = await repository.projects.create({
        Description: "",
        LifecycleId: lifecycleId,
        Name: projectName,
        ProjectGroupId: groupId,
    });

    const dp = await repository.deploymentProcesses.get(project.DeploymentProcessId, undefined);
    dp.Steps = [
        {
            Condition: RunCondition.Success,
            Links: {},
            PackageRequirement: PackageRequirement.LetOctopusDecide,
            StartTrigger: StartTrigger.StartAfterPrevious,
            Id: "",
            Name: "my step",
            Properties: { "Octopus.Action.TargetRoles": "deploy" },
            Actions: [
                {
                    Id: "",
                    Name: "Run a Script",
                    ActionType: "Octopus.Script",
                    Notes: null,
                    IsDisabled: false,
                    CanBeUsedForProjectVersioning: false,
                    IsRequired: false,
                    WorkerPoolId: null,
                    Container: {
                        Image: null,
                        FeedId: null,
                    },
                    WorkerPoolVariable: "",
                    Environments: [],
                    ExcludedEnvironments: [],
                    Channels: [],
                    TenantTags: [],
                    Packages: [],
                    Condition: RunConditionForAction.Success,
                    Properties: {
                        "Octopus.Action.RunOnServer": "false",
                        "Octopus.Action.Script.ScriptSource": "Inline",
                        "Octopus.Action.Script.Syntax": "Bash",
                        "Octopus.Action.Script.ScriptBody": "echo 'hello'",
                    },
                    Links: {},
                },
            ],
        },
    ];
    console.log("Updating process");
    await repository.deploymentProcesses.saveToProject(project, dp);

    console.log("Creating environments");
    const environment1 = await repository.environments.create({ Name: "Development" });
    const environment2 = await repository.environments.create({ Name: "Test" });

    console.log("Creating machine");

    await repository.machines.create({
        Endpoint: {
            CommunicationStyle: CommunicationStyle.None,
        },
        EnvironmentIds: [environment1.Id, environment2.Id],
        Name: "Unknown",
        Roles: ["deploy"],
        TenantedDeploymentParticipation: TenantedDeploymentMode.TenantedOrUntenanted,
    } as NewDeploymentTargetResource);
}

run();
