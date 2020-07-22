function OctopusStatusWidgetConfiguration() {
    this.Configure = function (WidgetHelpers, VSS_Auth_Service) {
        WidgetHelpers.IncludeWidgetConfigurationStyles();
        VSS.register("OctoProjectEnvironmentWidget.Configuration", function () {
            var $connectionDropdown = $("#octopus-connection");
            var $spaceDropdown = $("#octopus-space");
            var $projectFilterInput = $("#octopus-project-filter");
            var $projectDropdown = $("#octopus-project");
            var $environmentDropdown = $("#octopus-environment");

            var saveSettings = function (configurationContext, connectionId, spaceId, spaceName, projectId, projectName, environmentId, environmentName) {
                console.debug("Saving settings - Connection: " + connectionId + ", Space: " + spaceId + ", Project: " + projectId + ", Environment: " + environmentId);
                var customSettings = {
                    data: JSON.stringify({
                        connectionId: connectionId,
                        spaceId: spaceId,
                        spaceName: spaceName,
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

            var fetchDataSourceContent = function (queryUri, token, name, spaceId, partialNameFilter) {
                let parameters = [];
                if (spaceId) {
                    parameters.push('"SpaceId":"' + spaceId + '"');
                }

                // We check explicitly for `null` in this case. There are cases where we need to pass an empty string through to our endpointUrl.
                if (partialNameFilter != null) {
                    parameters.push('"PartialNameFilter":"' + partialNameFilter + '"');
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

            var refreshSpacesProjectsAndEnvironmentsDropdowns = function (settings, queryUri, authToken) {
                $spaceDropdown.empty();
                $spaceDropdown.prop("disabled", true);
                $projectFilterInput.empty();
                $projectDropdown.empty();
                $environmentDropdown.empty();

                const appendSpaceData = appendDropdownOptions($spaceDropdown, parseResult, selectId, selectName, settings ? settings.spaceId : null);
                const appendProjectData = appendDropdownOptions($projectDropdown, parseResult, selectId, selectName, settings ? settings.projectId : null);
                const appendEnvironmentData = appendDropdownOptions($environmentDropdown, parseResult, selectId, selectName, settings ? settings.environmentId : null);

                // TODO: Review - this results in undesired UX when editing an existing widget (you end up with two project names on top of each other).
                // TODO: With all the onChange events going on here, how can we achieve this nicely using our new list endpoints? (consider projects that do _not_ exist in the first page of results).
                if (settings && settings.projectName) {
                    // Populate our project search with our project name.
                    $projectFilterInput.val(settings.projectName);
                }

                fetchDataSourceContent(queryUri, authToken, "OctopusAllSpaces", null, null).done(function (data) {
                    const hasSpaces = !data.errorMessage;
                    if (hasSpaces) {
                        $spaceDropdown.prop("disabled", false);
                        appendSpaceData(data);

                        const selectedSpaceId = $spaceDropdown.val();
                        fetchDataSourceContent(queryUri, authToken, "OctopusListProjectsInSpace", selectedSpaceId, $projectFilterInput.val()).done(appendProjectData);
                        fetchDataSourceContent(queryUri, authToken, "OctopusAllEnvironmentsInSpace", selectedSpaceId, null).done(appendEnvironmentData);
                    } else {
                        fetchDataSourceContent(queryUri, authToken, "OctopusListProjects", null, $projectFilterInput.val()).done(appendProjectData);
                        fetchDataSourceContent(queryUri, authToken, "OctopusAllEnvironments", null, null).done(appendEnvironmentData);
                    }
                });
            };

            var refreshProjectsAndEnvironmentsInSpaceDropdowns = function (settings, queryUri, authToken, spaceId, projectNameFilter) {
                $projectDropdown.empty();
                $environmentDropdown.empty();

                var appendProjectData = appendDropdownOptions($projectDropdown, parseResult, selectId, selectName, settings ? settings.projectId : null);
                fetchDataSourceContent(queryUri, authToken, "OctopusListProjectsInSpace", spaceId, projectNameFilter).done(appendProjectData);

                var appendEnvironmentData = appendDropdownOptions($environmentDropdown, parseResult, selectId, selectName, settings ? settings.environmentId : null);
                fetchDataSourceContent(queryUri, authToken, "OctopusAllEnvironmentsInSpace", spaceId, null).done(appendEnvironmentData);
            };

            var refreshProjectsInSpaceDropdowns = function (settings, queryUri, authToken, spaceId, projectNameFilter) {
                $projectDropdown.empty();

                var appendProjectData = appendDropdownOptions($projectDropdown, parseResult, selectId, selectName, settings ? settings.projectId : null);
                fetchDataSourceContent(queryUri, authToken, "OctopusListProjectsInSpace", spaceId, projectNameFilter).done(appendProjectData);
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
                                refreshSpacesProjectsAndEnvironmentsDropdowns(settings, queryUri(), authToken);

                                $connectionDropdown.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                    refreshSpacesProjectsAndEnvironmentsDropdowns(settings, queryUri(), authToken);
                                });

                                $spaceDropdown.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                    refreshProjectsAndEnvironmentsInSpaceDropdowns(settings, queryUri(), authToken, $spaceDropdown.val(), $projectFilterInput.val());
                                });

                                $projectFilterInput.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
                                        $projectDropdown.val(),
                                        $(":selected", $projectDropdown).text(),
                                        $environmentDropdown.val(),
                                        $(":selected", $environmentDropdown).text()
                                    );
                                    refreshProjectsInSpaceDropdowns(settings, queryUri(), authToken, $spaceDropdown.val(), $projectFilterInput.val());
                                });

                                $projectDropdown.on("change", function () {
                                    saveSettings(
                                        widgetConfigurationContext,
                                        $connectionDropdown.val(),
                                        $spaceDropdown.val(),
                                        $(":selected", $spaceDropdown).text(),
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
