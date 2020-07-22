function OctopusStatusWidgetConfiguration() {
    this.Configure = function (WidgetHelpers, VSS_Auth_Service) {
        WidgetHelpers.IncludeWidgetConfigurationStyles();
        VSS.register("OctoProjectEnvironmentWidget.Configuration", function () {
            var $connectionDropdown = $("#octopus-connection");
            var $spaceDropdown = $("#octopus-space");
            var $projectGroupDropdown = $("#octopus-project-group");
            var $projectDropdown = $("#octopus-project");
            var $environmentDropdown = $("#octopus-environment");

            var saveSettings = function (configurationContext, connectionId, spaceId, spaceName, projectGroupId, projectGroupName, projectId, projectName, environmentId, environmentName) {
                console.debug("Saving settings - Connection: " + connectionId + ", Space: " + spaceId + ", ProjectGroup: " + projectGroupId + ", Project: " + projectId + ", Environment: " + environmentId);
                var customSettings = {
                    data: JSON.stringify({
                        connectionId: connectionId,
                        spaceId: spaceId,
                        spaceName: spaceName,
                        projectGroupId: projectGroupId,
                        projectGroupName: projectGroupName,
                        projectId: projectId,
                        projectName: projectName,
                        environmentId: environmentId,
                        environmentName: environmentName,
                    }),
                };

                if (configurationContext) {
                    var eventName = WidgetHelpers.WidgetEvent.ConfigurationChange;
                    var eventArgs = WidgetHelpers.WidgetEvent.Args(customSettings);
                    configurationContext.notify(eventName, eventArgs);
                }
                return customSettings;
            };

            var fetchDataSourceContent = function (queryUri, token, name, spaceId, projectGroupId) {
                let parameters = [];
                if (spaceId) {
                    parameters.push('"SpaceId":"' + spaceId + '"');
                }
                if (projectGroupId) {
                    parameters.push('"ProjectGroupId":"' + projectGroupId + '"');
                }

                // TODO: Refactor - we should really include interfaces for these and JSON.stringify() instead of string concatenation like this.
                // TODO: Refactor - we also want to switch to using the latest `azure-devops-extension-sdk` so we can take advantage of the new UI components.
                let query;
                if (parameters.length > 0) {
                    let parametersCsv = "{" + parameters.join(", ") + "}";
                    query = '{"dataSourceDetails": {"dataSourceName":"' + name + '", "parameters": ' + parametersCsv + " } }";
                } else {
                    query = '{"dataSourceDetails": {"dataSourceName":"' + name + '"}}';
                }
                console.debug("query=", query);

                return $.ajax({
                    type: "POST",
                    url: queryUri,
                    data: query,
                    contentType: "application/json",
                    dataType: "json",
                    headers: { Authorization: token },
                });
            };

            var appendDropdownOptions = function ($element, resultSelector, idSelector, nameSelector, selection) {
                return function (data) {
                    // A failed data source request will come back as okay but with an associated error message.
                    if (data.errorMessage) {
                        console.error(data.errorMessage);
                        return;
                    }
                    var selected = selection;
                    resultSelector(data).forEach(function (result) {
                        if (!selected) {
                            selected = idSelector(result);
                        }
                        $element.append($('<option value="' + idSelector(result) + '">' + nameSelector(result) + "</option>"));
                    });
                    $element.val(selected);
                };
            };

            var selectId = function (val) {
                if (!val) {
                    return null;
                }
                return val.id ? val.id : val.Id;
            };

            var selectName = function (val) {
                if (!val) {
                    return null;
                }
                return val.name ? val.name : val.Name;
            };

            var prop = function (name) {
                return function (val) {
                    if (val) {
                        return val[name];
                    }
                    return null;
                };
            };

            var parseResult = function (data) {
                return (prop("result")(data) || []).map(JSON.parse);
            };

            var refreshSpacesProjectGroupsAndEnvironmentsDropdowns = function (settings, queryUri, authToken) {
                $spaceDropdown.empty();
                $spaceDropdown.prop("disabled", true);
                $projectGroupDropdown.empty();
                $projectDropdown.empty();
                $environmentDropdown.empty();

                const appendSpaceData = appendDropdownOptions($spaceDropdown, parseResult, selectId, selectName, settings ? settings.spaceId : null);
                const appendProjectGroupData = appendDropdownOptions($projectGroupDropdown, parseResult, selectId, selectName, settings ? settings.projectGroupId : null);
                const appendProjectData = appendDropdownOptions($projectDropdown, parseResult, selectId, selectName, settings ? settings.projectId : null);
                const appendEnvironmentData = appendDropdownOptions($environmentDropdown, parseResult, selectId, selectName, settings ? settings.environmentId : null);

                fetchDataSourceContent(queryUri, authToken, "OctopusAllSpaces", null, null).done(function (data) {
                    const hasSpaces = !data.errorMessage;
                    if (hasSpaces) {
                        $spaceDropdown.prop("disabled", false);
                        appendSpaceData(data);
                        const selectedSpaceId = $spaceDropdown.val();

                        fetchDataSourceContent(queryUri, authToken, "OctopusAllProjectGroupsInSpace", selectedSpaceId, null).done(function (projectGroupData) {
                            appendProjectGroupData(projectGroupData);
                            const selectedProjectGroupId = $projectGroupDropdown.val();
                            fetchDataSourceContent(queryUri, authToken, "OctopusListProjectsInProjectGroupInSpace", selectedSpaceId, selectedProjectGroupId).done(appendProjectData);
                        });

                        fetchDataSourceContent(queryUri, authToken, "OctopusAllEnvironmentsInSpace", selectedSpaceId, null).done(appendEnvironmentData);
                    } else {
                        fetchDataSourceContent(queryUri, authToken, "OctopusListProjectGroups", null, null).done(function (projectGroupData) {
                            appendProjectGroupData(projectGroupData);
                            const selectedProjectGroupId = $projectGroupDropdown.val();
                            fetchDataSourceContent(queryUri, authToken, "OctopusListProjectsInProjectGroup", null, selectedProjectGroupId).done(appendProjectData);
                        });

                        fetchDataSourceContent(queryUri, authToken, "OctopusAllEnvironments", null, null).done(appendEnvironmentData);
                    }
                });
            };

            var refreshProjectGroupsAndEnvironmentsInSpaceDropdowns = function (settings, queryUri, authToken, spaceId) {
                $projectGroupDropdown.empty();
                $projectDropdown.empty();
                $environmentDropdown.empty();

                var appendProjectGroupData = appendDropdownOptions($projectGroupDropdown, parseResult, selectId, selectName, settings ? settings.projectGroupId : null);
                var appendProjectData = appendDropdownOptions($projectDropdown, parseResult, selectId, selectName, settings ? settings.projectId : null);

                fetchDataSourceContent(queryUri, authToken, "OctopusAllProjectGroupsInSpace", selectedSpaceId, null).done(function (projectGroupData) {
                    appendProjectGroupData(projectGroupData);
                    const selectedProjectGroupId = $projectGroupDropdown.val();
                    fetchDataSourceContent(queryUri, authToken, "OctopusListProjectsInProjectGroupInSpace", selectedSpaceId, selectedProjectGroupId).done(appendProjectData);
                });

                var appendEnvironmentData = appendDropdownOptions($environmentDropdown, parseResult, selectId, selectName, settings ? settings.environmentId : null);
                fetchDataSourceContent(queryUri, authToken, "OctopusAllEnvironmentsInSpace", spaceId, null).done(appendEnvironmentData);
            };

            var refreshProjectsInSpaceDropdowns = function (settings, queryUri, authToken, spaceId, projectGroupId) {
                $projectDropdown.empty();

                var appendProjectData = appendDropdownOptions($projectDropdown, parseResult, selectId, selectName, settings ? settings.projectId : null);
                fetchDataSourceContent(queryUri, authToken, "OctopusListProjectsInProjectGroupInSpace", spaceId, projectGroupId).done(appendProjectData);
            };

            var getConnectionQueryUri = function (baseUri, $element) {
                return function () {
                    var result = baseUri + "/_apis/distributedtask/serviceendpointproxy?endpointId=" + $element.val() + "&api-version=3.0-preview.1";
                    return result;
                };
            };

            return {
                load: function (widgetSettings, widgetConfigurationContext) {
                    var settings = JSON.parse(widgetSettings.customSettings.data);

                    return VSS.getAccessToken().then(function (token) {
                        var webContext = VSS.getWebContext();
                        var baseUri = webContext.collection.uri + "/" + webContext.project.name;
                        var endpointUri = baseUri + "/_apis/distributedtask/serviceendpoints?type=OctopusEndpoint&api-version=3.0-preview.1";

                        var authToken = VSS_Auth_Service.authTokenManager.getAuthorizationHeader(token);

                        return new Promise((resolve, reject) => {
                            $.ajax({
                                type: "GET",
                                url: endpointUri,
                                headers: { Authorization: authToken },
                            }).done(function (data) {
                                appendDropdownOptions($connectionDropdown, prop("value"), selectId, selectName, settings ? settings.connectionId : null)(data);
                                var queryUri = getConnectionQueryUri(baseUri, $connectionDropdown);
                                refreshSpacesProjectGroupsAndEnvironmentsDropdowns(settings, queryUri(), authToken);

                                $connectionDropdown.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectGroupDropdown.val(),
                                        $(":selected", $projectGroupDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                    refreshSpacesProjectGroupsAndEnvironmentsDropdowns(settings, queryUri(), authToken);
                                });

                                $spaceDropdown.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectGroupDropdown.val(),
                                        $(":selected", $projectGroupDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                    refreshProjectGroupsAndEnvironmentsInSpaceDropdowns(settings, queryUri(), authToken, $spaceDropdown.val());
                                });

                                $projectGroupDropdown.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectGroupDropdown.val(),
                                        $(":selected", $projectGroupDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                    refreshProjectsInSpaceDropdowns(settings, queryUri(), authToken, $spaceDropdown.val(), $projectGroupDropdown.val());
                                });

                                $projectDropdown.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectGroupDropdown.val(),
                                        $(":selected", $projectGroupDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                });

                                $environmentDropdown.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectGroupDropdown.val(),
                                        $(":selected", $projectGroupDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                });

                                // Initialise the widget with initial settings as these values don't exist yet.
                                if (!settings) {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectGroupDropdown.val(),
                                        $(":selected", $projectGroupDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                }

                                resolve(WidgetHelpers.WidgetStatusHelper.Success());
                            });
                        });
                    });
                },
                onSave: function () {
                    var customSettings = saveSettings(
                        null,
                        $connectionDropdown.val(),
                        $spaceDropdown.val(),
                        $(":selected", $spaceDropdown).text(),
                        $projectGroupDropdown.val(),
                        $(":selected", $projectGroupDropdown).text(),
                        $projectDropdown.val(),
                        $(":selected", $projectDropdown).text(),
                        $environmentDropdown.val(),
                        $(":selected", $environmentDropdown).text()
                    );
                    return WidgetHelpers.WidgetConfigurationSave.Valid(customSettings);
                },
            };
        });
        VSS.notifyLoadSucceeded();
    };
}
