const reactAppRewiredOverrideFn = require('../config-overrides')

module.exports = {
  "stories": [
    "../src/**/*.stories.mdx",
    "../src/**/*.stories.@(js|jsx|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/preset-create-react-app"
  ],
  // Apply same webpack config overrides as react-app-rewired does.
  "webpackFinal": async (config) => reactAppRewiredOverrideFn(config),
}
