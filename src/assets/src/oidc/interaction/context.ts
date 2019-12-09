import React from "react";
import { OIDCInteractionProps } from "./types";
import { AnimationStyles } from "../styles";

export const OIDCInteractionContext = React.createContext({
  pop: () => {},
  push: (page: any) => {},
  animation: AnimationStyles.slideLeftIn40,
  key: 0,
  size: 0,
});

export function requestOIDCInteraction(
  action: {
    url: string,
    method: string,
    data?: any,
    urlencoded?: boolean,
  },
  mergeData: any = {},
): Promise<OIDCInteractionProps> {
  const {url, method, data = {}, urlencoded = false} = action;
  const payload = {...data, ...mergeData};

  // as application/x-www-form-urlencoded
  if (urlencoded) {
    const form = document.createElement("form");
    form.action = url;
    form.method = method;
    form.style.display = "none";
    // tslint:disable-next-line:forin
    for (const k in payload) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = payload[k];
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    return new Promise<any>(resolve => {});
  }

  // as ajax
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: method !== "GET" ? JSON.stringify(payload) : undefined,
    credentials: "same-origin",
  })
    .then(res => res.json())
    .catch(error => ({error}));
}
