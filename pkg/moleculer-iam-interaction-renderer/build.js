/* react-app-rewired: config-overrides.js */

const path = require("path");
const fs = require("fs");
const webpack = require('webpack');
const CopyPlugin = require("copy-webpack-plugin");
const buildConfig = require("./build.config");

// ref: https://github.com/react-navigation/react-navigation/issues/6757#issuecomment-583319859
// shim react-navigation missing types by edit code directly
Object.entries({
  DrawerRouter: ["DrawerActionType", "DrawerNavigationState", "DrawerRouterOptions"],
  StackRouter: ["StackActionType", "StackNavigationState", "StackRouterOptions"],
  TabRouter: ["TabActionType", "TabNavigationState", "TabRouterOptions"],
}).forEach(([file, types]) => {
  const filePath = require.resolve(`@react-navigation/routers/lib/module/${file}.js`);
  const code = fs.readFileSync(filePath).toString();
  if (code.endsWith("/*shim-added*/")) return;
  fs.writeFileSync(filePath, `${code}\n${types.map(type => `export const ${type} = null;`).join("\n")}/*shim-added*/`);
});

// ref: https://github.com/timarney/react-app-rewired
module.exports = {
  webpack: (config) => {
    const babelRule = config.module.rules[2].oneOf[1];
    babelRule.include = [
      babelRule.include,
      require.resolve("@react-navigation/stack"),
      require.resolve("react-native-screens/src/screens.web.js"),
      path.join(require.resolve("react-native-reanimated"), ".."),
      path.join(require.resolve("react-native-gesture-handler"), ".."),
      path.join(require.resolve("react-native-eva-icons"), ".."),
      require.resolve("./build.shim.rnw.tsx"),
    ];
    babelRule.options.presets.push(require.resolve("metro-react-native-babel-preset"));
    // process.exit();

    // to import ./server-state.ts
    config.resolve.plugins = config.resolve.plugins.filter(plugin => plugin.constructor.name !== "ModuleScopePlugin");

    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          "react-native$": "react-native-web",
        },
      },
      plugins: [
        new CopyPlugin([
          { from: path.resolve(__dirname, "./public"), to: buildConfig.webpack.output.path },
        ]),
        new webpack.DefinePlugin({
          __DEV__: process.env.NODE_ENV !== "production",
        }),
        new webpack.NormalModuleReplacementPlugin(
          /^react-native$/,
          path.resolve(__dirname, "./build.shim.rnw.tsx"),
        ),
        ...config.plugins,
      ],
      output: {
        ...config.output,
        ...buildConfig.webpack.output,
      },
    };
  },
  devServer: (configFunction) => {
    return (proxy, allowedHost) => {
      const config = configFunction(proxy, allowedHost);

      return {
        ...config,
        open: false, // why it doesn't work...?
        logLevel: "debug",
        writeToDisk: true,
        contentBase: buildConfig.webpack.output.path,
        contentBasePublicPath: buildConfig.webpack.output.publicPath,
      };
    };
  },
  paths(paths) {
    paths.appBuild = buildConfig.webpack.output.path;
    return paths;
  },
};