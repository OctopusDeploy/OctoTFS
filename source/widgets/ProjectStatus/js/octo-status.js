function OctopusStatusWidget() {
    this.Configure = function (WidgetHelpers, VSS_Auth_Service) {
        WidgetHelpers.IncludeWidgetStyles();
        VSS.register("OctoProjectEnvironmentWidget", function () {
            var $octoWidget = $("#octo-widget");
            var $statusIconDiv = $("#octo-info-statusIcon");
            var $versionSpan = $("#octo-info-version");
            var $releaseDateSpan = $("#octo-info-releasedate");
            var $linkElement = $("#octo-info-link");
            var $projectH2 = $("#octo-info-project");
            var $environmentH3Span = $("#octo-info-environment");
            var $spaceH3Span = $("#octo-info-space");
            var $statusDescriptionDiv = $("#octo-extra-description");

            var getOctopusStatus = function (widgetSettings) {
                var settings = JSON.parse(widgetSettings.customSettings.data);
                if (!settings || !settings.connectionId) {
                    $projectH2.text("Not configured");
                    return WidgetHelpers.WidgetStatusHelper.Success();
                }
                // clear
                $projectH2.text("Loading...");
                $environmentH3Span.text("");
                $spaceH3Span.text("");
                $versionSpan.text("");
                $releaseDateSpan.text("");
                $linkElement.removeAttr("href");
                $statusIconDiv.removeClass("bowtie-status-success bowtie-status-failure bowtie-status-run bowtie-status-warning bowtie-status-help");
                $statusDescriptionDiv.text("");

                VSS.getAccessToken().then(function (token) {
                    var webContext = VSS.getWebContext();
                    console.debug("Collection URI: " + webContext.collection.uri);
                    console.debug("Project Name: " + webContext.project.name);
                    var baseUri = webContext.collection.uri + "/" + webContext.project.name;
                    var endpointUri = baseUri + "/_apis/distributedtask/serviceendpoints/" + settings.connectionId + "?api-version=3.0-preview.1";

                    var authToken = VSS_Auth_Service.authTokenManager.getAuthorizationHeader(token);

                    $.ajax({
                        type: "GET",
                        url: endpointUri,
                        contentType: "application/json",
                        dataType: "json",
                        headers: { Authorization: authToken },
                    }).done(function (data) {
                        var endpointDetails = data;

                        var queryUri = baseUri + "/_apis/distributedtask/serviceendpointproxy?endpointId=" + settings.connectionId + "&api-version=3.0-preview.1";

                        var dashboardQueryContent;

                        if (settings.spaceId) {
                            dashboardQueryContent = '{"dataSourceDetails": {"dataSourceName":"OctopusDashboardForProjectInSpace", "parameters":{"SpaceId": "' + settings.spaceId + '", "ProjectId": "' + settings.projectId + '"}}}';
                        } else {
                            dashboardQueryContent = '{"dataSourceDetails": {"dataSourceName":"OctopusDashboardForProject", "parameters":{"ProjectId": "' + settings.projectId + '"}}}';
                        }

                        $.ajax({
                            type: "POST",
                            url: queryUri,
                            data: dashboardQueryContent,
                            contentType: "application/json",
                            dataType: "json",
                            headers: { Authorization: authToken },
                        }).done(function (data) {
                            if (data.errorMessage) {
                                console.error(data.errorMessage);
                                return;
                            }

                            var dashboard = JSON.parse(data.result[0]); // todo: safely get last
                            var deploymentElement = null;
                            dashboard.Items.some(function (element) {
                                if (element.EnvironmentId === settings.environmentId && element.IsCurrent) {
                                    deploymentElement = element;
                                    return true;
                                }
                            });
                            if (deploymentElement) {
                                $projectH2.text(settings.projectName).attr("title", settings.projectName);
                                if (settings.spaceId) {
                                    $spaceH3Span.text(settings.spaceName + "-");
                                }
                                $environmentH3Span.text(settings.environmentName);
                                $versionSpan.text(deploymentElement.ReleaseVersion);
                                if (deploymentElement.IsCompleted) {
                                    $releaseDateSpan.text(moment(deploymentElement.CompletedTime).format("LL"));
                                } else {
                                    $releaseDateSpan.text(deploymentElement.State);
                                }
                                $linkElement.attr("href", endpointDetails.url + "/app#/tasks/" + deploymentElement.TaskId);

                                if (deploymentElement.State === "Success" && !deploymentElement.HasWarningsOrErrors) {
                                    $statusIconDiv.addClass("bowtie-status-success");
                                    $statusDescriptionDiv.text("Duration: " + deploymentElement.Duration);
                                } else if (deploymentElement.State === "Success") {
                                    $statusIconDiv.addClass("bowtie-status-warning");
                                    $statusDescriptionDiv.text("Duration: " + deploymentElement.Duration);
                                } else if (deploymentElement.State === "Failed") {
                                    $statusIconDiv.addClass("bowtie-status-failure");
                                    $statusDescriptionDiv.text(deploymentElement.ErrorMessage);
                                } else if (!deploymentElement.IsCompleted) {
                                    $statusIconDiv.addClass("bowtie-status-run");
                                } else {
                                    $statusIconDiv.addClass("bowtie-status-help");
                                }
                            } else {
                                $projectH2.text("");
                                if (settings.spaceName) {
                                    $environmentH3Span.text("No deployment found for " + settings.projectName + " to " + settings.environmentName + " in the " + settings.spaceName + " space.");
                                } else {
                                    $environmentH3Span.text("No deployment found for " + settings.projectName + " to " + settings.environmentName);
                                }
                            }
                        });
                    });
                });
                return WidgetHelpers.WidgetStatusHelper.Success();
            };

            return {
                load: function (widgetSettings) {
                    return getOctopusStatus(widgetSettings);
                },
                reload: function (widgetSettings) {
                    return getOctopusStatus(widgetSettings);
                },
            };
        });

        VSS.notifyLoadSucceeded();
    };
}
