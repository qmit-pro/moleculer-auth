import { Client } from "../provider";
import { Identity } from "../../identity";

export async function getPublicClientProps(client?: Client) {
  if (!client) return;
  return {
    id: client.clientId,
    name: client.clientName,
    logo_uri: client.logoUri || null,
    tos_uri: client.tosUri || null,
    policy_uri: client.policyUri || null,
    client_uri: client.clientUri,
  };
}

export async function getPublicUserProps(id?: Identity) {
  if (!id) return;
  const {email, picture, name} = await id.claims("userinfo", "profile email");
  return {
    email,
    name: name || "unknown",
    picture: picture || null,
  };
}