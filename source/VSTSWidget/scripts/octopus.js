
VSS.init({
    explicitNotifyLoaded: true,
    usePlatformStyles: true
});

VSS.require("TFS/Dashboards/WidgetHelpers", function (WidgetHelpers) {
    WidgetHelpers.IncludeWidgetStyles();
    VSS.register("OctopusWidget", function () {

        var getCurrentDeploymentStatus = function (widgetSettings) {
            var settings = JSON.parse(widgetSettings.customSettings.data);

            if (settings && settings.octopusUrl && settings.octopusApiKey && settings.projectId) {

                var doRequest = function (requestUrl) {
                    return $.ajax({
                        type: "GET",
                        url: settings.octopusUrl + requestUrl,
                        crossDomain: true,
                        headers: {
                            "X-Octopus-ApiKey": settings.octopusApiKey
                        },
                    });
                }

                var projectId = settings.projectId;
                var environmentId = settings.environmentId;

                $.when
                (
                    doRequest("/api/projects/" + projectId),
                    doRequest("/api/environments/" + environmentId)
                )
                .done(function (getProjectResult, getEnvironmentsResult) {

                    var project = getProjectResult[0];
                    var environment = getEnvironmentsResult[0];

                    $("#projectName").text(project.Name);
                    $("#environmentName").text(environment.Name);

                    var lastDeployment = null;
                    var release = null;
                    var task = null;

                    $.when
                    (
                        doRequest("/api/deployments?projects=" + project.Id + "&environments=" + environment.Id)
                    )
                    .done(function (getDeploymentsResult) {

                        if (getDeploymentsResult && getDeploymentsResult.Items) {
                            lastDeployment = getDeploymentsResult.Items[0];

                            $.when
                            (
                                doRequest(lastDeployment.Links.Release),
                                doRequest(lastDeployment.Links.Task
                                )
                            )
                            .done(function (getReleaseResult, getTaskResult) {
                                release = getReleaseResult[0];
                                task = getTaskResult[0];

                                if (task) {
                                    $(".widget").addClass("dark-widget");

                                    if (task.State === "Success") {
                                        $(".widget").css("background-color", "#339933");
                                        $("#statusIcon").addClass("fa-check");
                                    }
                                    if (task.State === "Failed") {
                                        $(".widget").css("background-color", "#e60017");
                                        $("#statusIcon").addClass("fa-exclamation-triangle");
                                    }
                                    if (task.State === "Executing") {
                                        $(".widget").css("background-color", "#009ccc");
                                        $("#statusIcon").addClass("fa-spinner fa-spin");
                                    }
                                    if (task.State === "Canceled" || task.State === "Canceling") {
                                        $(".widget").css("background-color", "#000000");
                                        $("#statusIcon").addClass("fa-user-times");
                                    }
                                    if (task.State === "TimedOut") {
                                        $(".widget").css("background-color", "#f7a24b");
                                        $("#statusIcon").addClass("fa-clock-o");
                                    }
                                }

                                $("#deploymentUrl").prop("href", settings.octopusUrl + "/app?#/projects/" + project.Name + "/releases/" + release.Version + "/deployments/" + lastDeployment.Id)
                                $("#version").text(release.Version)
                                return WidgetHelpers.WidgetStatusHelper.Success();
                            });
                        }
                    });
                });
            }

            return WidgetHelpers.WidgetStatusHelper.Success();
        }

        return {
            load: function (widgetSettings) {
                return getCurrentDeploymentStatus(widgetSettings);
            },
            reload: function (widgetSettings) {
                return getCurrentDeploymentStatus(widgetSettings);
            }
        }
    });
    VSS.notifyLoadSucceeded();
});