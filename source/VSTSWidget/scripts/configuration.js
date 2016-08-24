VSS.init({
    explicitNotifyLoaded: true,
    usePlatformStyles: true
});

VSS.require("TFS/Dashboards/WidgetHelpers", function (WidgetHelpers) {
    WidgetHelpers.IncludeWidgetConfigurationStyles();
    VSS.register("OctopusWidget.Configuration", function () {

        var projectsDropdown = $("#projects-dropdown");
        var environmentsDropdown = $("#environments-dropdown");
        var octopusUrlInput = $("#octopusUrl");
        var octopusApiKeyInput = $("#octopusApiKey");

        function getSettings() {
            return {
                octopusUrl: octopusUrlInput.val(),
                octopusApiKey: octopusApiKeyInput.val(),
                projectId: projectsDropdown.val(),
                environmentId: environmentsDropdown.val()
            }
        };

        return {
            load: function (widgetSettings, widgetConfigurationContext) {
                var settings = JSON.parse(widgetSettings.customSettings.data);

                if (settings) {
                    if (settings.octopusApiKey) {
                        octopusApiKeyInput.val(settings.octopusApiKey)
                    }
                    if (settings.octopusUrl) {
                        octopusUrlInput.val(settings.octopusUrl)
                    }
                }

                var doRequest = function (requestUrl) {
                    if (settings && settings.octopusUrl && settings.octopusApiKey) {
                        return $.ajax({
                            type: "GET",
                            url: settings.octopusUrl + requestUrl,
                            crossDomain: true,
                            headers: {
                                "X-Octopus-ApiKey": settings.octopusApiKey
                            }
                        });
                    }
                    return null;
                }

                var getProjectsAndEnvironments = function () {
                    $.when
                    (
                        doRequest("/api/projects"),
                        doRequest("/api/environments")
                    )
                    .done(function (getProjectsResult, getEnvironmentsResult) {
                        if (getProjectsResult && getProjectsResult[0] && getProjectsResult[0].Items) {
                            var projects = getProjectsResult[0].Items;
                            for (var i = 0; i < projects.length; i++) {
                                var project = projects[i];
                                projectsDropdown.append($("<option></option>").attr("value", project.Id).text(project.Name))
                            }

                            if (settings.projectId) {
                                projectsDropdown.val(settings.projectId);
                            }
                        }
                        if (getEnvironmentsResult && getEnvironmentsResult[0] && getEnvironmentsResult[0].Items) {
                            var environments = getEnvironmentsResult[0].Items;
                            for (var i = 0; i < environments.length; i++) {
                                var environment = environments[i];
                                environmentsDropdown.append($("<option></option>").attr("value", environment.Id).text(environment.Name))
                            }

                            if (settings.environmentId) {
                                environmentsDropdown.val(settings.environmentId);
                            }
                        }
                    });
                }

                var updateSettings = function () {
                    settings = getSettings();
                    var eventName = WidgetHelpers.WidgetEvent.ConfigurationChange;
                    var eventArgs = WidgetHelpers.WidgetEvent.Args({ data: JSON.stringify(settings) });
                    widgetConfigurationContext.notify(eventName, eventArgs);
                }

                octopusUrlInput.on("change", function () {
                    updateSettings();
                    getProjectsAndEnvironments();
                });

                octopusApiKeyInput.on("change", function () {
                    updateSettings();
                    getProjectsAndEnvironments();
                });

                projectsDropdown.on("change", function () {
                    updateSettings();
                });

                environmentsDropdown.on("change", function () {
                    updateSettings();
                });

                getProjectsAndEnvironments();

                return WidgetHelpers.WidgetStatusHelper.Success();
            },
            onSave: function () {
                return WidgetHelpers.WidgetConfigurationSave.Valid({ data: JSON.stringify(getSettings()) });
            }
        }
    });
    VSS.notifyLoadSucceeded();
});