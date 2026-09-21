import { google } from "googleapis";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;
type Credentials = Parameters<OAuth2Client["setCredentials"]>[0];

interface OAuthClientConfig {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
}

export interface OAuthKeys {
  installed?: OAuthClientConfig;
  web?: OAuthClientConfig;
}

export function createOAuthClient(
  oauthKeys: OAuthKeys,
  credentials: Credentials,
) {
  const clientConfig = oauthKeys.installed ?? oauthKeys.web;
  if (!clientConfig) {
    throw new Error("OAuth keys must include an installed or web client");
  }

  const auth = new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    clientConfig.redirect_uris?.[0],
  );
  auth.setCredentials(credentials);
  return auth;
}
