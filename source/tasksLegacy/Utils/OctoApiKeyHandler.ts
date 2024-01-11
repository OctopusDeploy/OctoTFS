/* eslint-disable @typescript-eslint/ban-ts-comment */
import { IRequestHandler, IHttpClientResponse } from "typed-rest-client/Interfaces";
import * as http from "http";

export class OctoApiKeyHandler implements IRequestHandler {
    key: string;

    constructor(key: string) {
        this.key = key;
    }

    prepareRequest(options: http.RequestOptions): void {
        // @ts-expect-error
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
