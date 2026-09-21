import { describe, expect, test } from "bun:test";
import { createOAuthClient, type OAuthKeys } from "./Auth.js";

const clientConfig = {
  client_id: "test-client-id",
  client_secret: "test-client-secret",
  redirect_uris: ["http://localhost"],
};

async function captureRefreshBody(oauthKeys: OAuthKeys) {
  const auth = createOAuthClient(oauthKeys, {
    access_token: "expired-access-token",
    refresh_token: "test-refresh-token",
    expiry_date: Date.now() - 60_000,
  });
  let requestBody: string | undefined;

  auth.transporter.request = (async (options) => {
    requestBody = options.data as string;
    return {
      data: {
        access_token: "refreshed-access-token",
        expires_in: 3600,
      },
    };
  }) as typeof auth.transporter.request;

  await auth.getAccessToken();
  expect(requestBody).toBeDefined();
  return new URLSearchParams(requestBody);
}

describe("createOAuthClient", () => {
  test("includes installed client credentials when refreshing an expired token", async () => {
    const refreshBody = await captureRefreshBody({ installed: clientConfig });

    expect(refreshBody.get("client_id")).toBe(clientConfig.client_id);
    expect(refreshBody.get("client_secret")).toBe(clientConfig.client_secret);
    expect(refreshBody.get("refresh_token")).toBe("test-refresh-token");
    expect(refreshBody.get("grant_type")).toBe("refresh_token");
  });

  test("supports web client credentials", async () => {
    const refreshBody = await captureRefreshBody({ web: clientConfig });

    expect(refreshBody.get("client_id")).toBe(clientConfig.client_id);
    expect(refreshBody.get("client_secret")).toBe(clientConfig.client_secret);
  });
});
