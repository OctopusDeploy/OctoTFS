import { getDeepLink } from "./connection";

describe("DeepLinks", () => {
    test("URL ends with / returns correctly formatted deep link", async () => {
        const url = "https://octopus.com/vdir/";
        const expectedDeepLink = "https://octopus.com/vdir/app#/Spaces-1/deployments/Deployments-1";
        expect(getDeepLink(url, "Spaces-1/deployments/Deployments-1")).toBe(expectedDeepLink);
    });

    test("URL does not end with / return correctly formatted deep link", async () => {
        const url = "https://octopus.com/vdir";
        const expectedDeepLink = "https://octopus.com/vdir/app#/Spaces-1/deployments/Deployments-1";
        expect(getDeepLink(url, "Spaces-1/deployments/Deployments-1")).toBe(expectedDeepLink);
    });
});
