import * as _ from "lodash";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { User, UserManager, UserManagerSettings } from "oidc-client";

export { User };

const defaultChangeLocation = async (url: string) => {
  if (location.href === url) return;
  if (url.startsWith(location.origin) && history.replaceState) {
    history.replaceState(undefined, document.title, url);
  } else {
    location.replace(url);
    await new Promise(() => {});
  }
};

export interface IUserContext {
  loading: boolean,
  user: User | undefined,
  signIn: (opts?: { redirectTo?: string, prompt?: "login" | "consent" | "none" }) => Promise<void>,
  signOut: (opts?: { redirectTo?: string, }) => Promise<void>,
  change: (opts?: { redirectTo?: string }) => Promise<void>,
  manage: () => Promise<void>,
  client: UserManager,
}

export const UserContext = createContext({
  client: undefined,
  loading: false,
  user: undefined,
  signIn: undefined,
  signOut: undefined,
  change: undefined,
  manage: undefined,
} as any as IUserContext);

export const useUserContext = () => useContext(UserContext);

export const useUserContextFactory = (
  oidc?: Partial<UserManagerSettings>,
  options?: { automaticSignIn?: undefined | "login" | "consent", changeLocation?: typeof defaultChangeLocation },
) => {
  const [context, setContext] = useState({
    client: undefined,
    loading: true,
    user: undefined,
    signIn: undefined,
    signOut: undefined,
    change: undefined,
    manage: undefined,
  } as any as IUserContext);

  useLayoutEffect(() => {
    const {
      automaticSignIn = false,
      changeLocation = defaultChangeLocation,
    } = options || {};

    // ref: https://github.com/IdentityModel/oidc-client-js/wiki
    const client = new UserManager(_.defaultsDeep(oidc || {}, {
      authority: "http://0.0.0.0:8080",
      client_id: window.location.origin,
      redirect_uri: window.location.origin,
      post_logout_redirect_uri: window.location.origin,
      response_type: "id_token token",
      response_mode: "fragment",
      prompt: "consent",
      scope: ["openid", "profile", "email", "phone", "offline_access"].join(" "),
      loadUserInfo: true,
      automaticSilentRenew: true,
      checkSessionInterval: 1000,
    }));

    // Log.logger = console;

    const signIn = async (opts?: {
      redirectTo?: string,
      prompt?: "login" | "consent" | "none",
    }) => {
      const {redirectTo = location.href, prompt} = opts || {};
      await client.signinRedirect({state: redirectTo, useReplaceToNavigate: false, prompt});
      await new Promise(() => {});
    };

    const signOut = async (opts?: {
      redirectTo?: string,
    }) => {
      const {redirectTo = location.href} = opts || {};
      await client.signoutRedirect({state: redirectTo, useReplaceToNavigate: false});
      await new Promise(() => {});
    };

    const change = async (opts?: { redirectTo?: string }) => {
      const {redirectTo = location.href} = opts || {};
      await client.signinRedirect({state: redirectTo, useReplaceToNavigate: false, prompt: "login"});
      await new Promise(() => {});
    };

    const manage = async () => {
      const url = `${client.settings.authority}`;
      if (location.origin === client.settings.authority && history.replaceState) {
        history.replaceState(undefined, document.title, url);
      } else {
        location.assign(url);
        await new Promise(() => {});
      }
    };

    setContext({loading: true, client, user: undefined, signIn, signOut, change, manage});

    client.getUser()
      .then(async (user) => {
        if (user) {
          setContext(ctx => ({...ctx, user: user!, loading: false}));
        } else {
          try {
            if (location.hash) {
              user = await client.signinRedirectCallback();
              setContext(ctx => ({...ctx, user: user!}));
              if (user.state) {
                await changeLocation(user.state);
              }
            }
          } catch (err) {
            // ...
          } finally {
            if (automaticSignIn && !user) {
              await signIn({ prompt: automaticSignIn });
            } else {
              try {
                const signOutResult = await client.signoutRedirectCallback();
                if (signOutResult.state) {
                  await changeLocation(signOutResult.state);
                }
              } catch (err) {
                // ...
              }
            }

            setContext(ctx => ({...ctx, loading: false}));
          }
        }
      });
  }, []);

  return context;
};
