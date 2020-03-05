import React, { ReactElement } from "react";
import { ScrollView, Image, View } from "react-native";
import { useAppOptions } from "../hook";
import { Layout, Text, Button, Spinner, withAttrs, withElement } from "./component";
import logo from "../assets/logo.svg";


// workaround to make autofocus works
const autofocus = (ref: any) => withElement(elem => (elem as any).focus && setTimeout(() => elem && (elem as any).focus(), 50), "[autofocus]")(ref && ref.getInnerViewNode());

export const ScreenLayout: React.FunctionComponent<{
  title?: string | ReactElement,
  subtitle?: string | ReactElement,
  loading?: boolean;
  buttons?: {
    text: string,
    onClick?: () => void | Promise<void>,
    primary?: boolean,
    tabIndex?: number,
    hidden?: boolean,
  }[],
  footer?: ReactElement,
  error?: string,
}> = ({title = "undefined", subtitle = null, loading = false, children = null, buttons = [], error = null, footer = null}) => {

  const [options] = useAppOptions();
  return (
    <>
      <ScrollView
        contentContainerStyle={{marginTop: "auto", marginBottom: "auto"}}
        ref={autofocus}
      >
        {/*<View style={{
          top: 0, right: 0, zIndex: 1000, alignItems: "flex-end", flex: 0,
          ...({
            position: "sticky",
            transition: "opacity 1s",
            opacity: loading ? 0.3 : 0,
          } as unknown as ViewStyle)
        }}>
          <View style={{margin: 20}}>
            <Spinner size={"tiny"} status={"primary"} />
          </View>
        </View>*/}
        <Layout
          style={{
            padding: "30px",
          }}
        >
          <View style={{alignItems: options.logo.align, marginBottom: 20}}>
            <Image source={{uri: options.logo.uri || logo}} style={{height: options.logo.height, width: options.logo.width, resizeMode: "contain"}}/>
          </View>

          <View style={{marginBottom: "30px"}}>
            <Text category={"h4"}>{title}</Text>
            {subtitle && <Text category={"s1"} style={{marginTop: 10}}>{subtitle}</Text>}
          </View>

          { children ? <View style={{marginBottom: "15px"}}>{children}</View> : null }

          <View style={{justifyContent: "flex-end"}}>
            {error ? <Text status={"danger"} category={"c2"} style={{marginTop: 10}}>{error}</Text> : null}
            {buttons.map(({hidden, primary, text, onClick, tabIndex}, index) => {
              if (hidden === true) {
                return null;
              }
              return (
                <Button ref={withAttrs({tabindex: tabIndex || null})}
                        key={index}
                        status={primary ? "primary" : "basic"} size={"large"}
                        style={{marginTop: 15}}
                        onPressOut={loading ? undefined : onClick}
                        appearance={"filled"}
                >{text}</Button>
              );
            })}
            {footer}
          </View>
        </Layout>
      </ScrollView>
    </>
  );
};
