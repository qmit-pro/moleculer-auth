import React, { useCallback, useContext, useState } from "react";
import { OIDCInteractionContext, OIDCInteractionProps, OIDCInteractionPage, requestOIDCInteraction } from "../";
import { TextFieldStyles, Text, TextField, Image, Stack } from "../../styles";
import { useWithLoading } from "../hook";
import svg from "./reset-password.svg";
import { LoginInteractionResetPasswordSent } from "./reset-password-sent";

export const LoginInteractionResetPassword: React.FunctionComponent<{ oidc: OIDCInteractionProps }> = ({oidc}) => {
  // states
  const context = useContext(OIDCInteractionContext);
  const {loading, errors, setErrors, withLoading} = useWithLoading();

  // props
  const { user, client } = oidc.interaction!.data!;

  // handlers
  const handleSend = useCallback(() => withLoading(async () => {
    const result = await requestOIDCInteraction(oidc.interaction!.action!.resetPassword, {
      email: user.email,
    });

    // done...
    const { error, interaction } = result;
    if (error) {
      setErrors({ global: error.message });
    } else {
      // request to send automatically
      console.log(interaction);
      context.push(<LoginInteractionResetPasswordSent oidc={result} />);
    }
  }), [withLoading]);

  const handleCancel = useCallback(() => withLoading(() => context.pop()), [withLoading]);

  // render
  return (
    <OIDCInteractionPage
      title={`Reset your password`}
      subtitle={user.email}
      buttons={[
        {
          primary: true,
          text: "Send",
          onClick: handleSend,
          loading,
          tabIndex: 2,
        },
        {
          text: "Cancel",
          onClick: handleCancel,
          loading,
          tabIndex: 3,
        },
      ]}
      error={errors.global}
    >
      <Text>
        We will send an email with a link to guide you to reset your password.
      </Text>
      <Image src={svg} styles={{root: {minHeight: "270px"}, image: {width: "100%"}}} />
    </OIDCInteractionPage>
  );
};