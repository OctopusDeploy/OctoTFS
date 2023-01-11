// import { executeCommand, MockOctopusToolRunner } from "../../Utils/testing";
// import { Deploy } from "./deploy";

// describe("Deploy Release", () => {
//     test("Create a minimum deployment", async () => {
//         const output = await executeCommand(() => new Deploy(new MockOctopusToolRunner(), { url: "http://octopus.com", apiKey: "myapikey", ignoreSslErrors: false }).run("my space", "my project", "1.2.3", ["dev"]));

//         expect(output).toContain("deploy-release --space my space --project my project --releaseNumber 1.2.3 --enableServiceMessages --deployTo dev --server http://octopus.com --apiKey myapikey");
//     });

//     test("Create a deployment", async () => {
//         const output = await executeCommand(() =>
//             new Deploy(new MockOctopusToolRunner(), { url: "http://octopus.com", apiKey: "myapikey", ignoreSslErrors: false }).run(
//                 "my space",
//                 "my project",
//                 "1.2.3",
//                 ["dev", "prod"],
//                 ["tenantA", "tenantB"],
//                 ["tagme", "tagyou"],
//                 false,
//                 "--myAdditionalArgumentToInclude"
//             )
//         );

//         expect(output).toContain(
//             "deploy-release --space my space --project my project --releaseNumber 1.2.3 --enableServiceMessages --deployTo dev --deployTo prod --tenant tenantA --tenant tenantB --tenantTag tagme --tenantTag tagyou --server http://octopus.com --apiKey myapikey --myAdditionalArgumentToInclude"
//         );
//     });
// });
