import { IRequestHandler, IHttpClientResponse } from "typed-rest-client/Interfaces";

export class OctoApiKeyHandler implements IRequestHandler {
    key: string;

    constructor(key: string) {
        this.key = key;
    }

    prepareRequest(options: any): void {
        options.headers["X-Octopus-ApiKey"] = this.key;
    }

    canHandleAuthentication(): boolean {
        return false;
    }

    handleAuthentication(): Promise<IHttpClientResponse> {
        throw "This handler does not handle authentication.";
    }
}

export default OctoApiKeyHandler;
