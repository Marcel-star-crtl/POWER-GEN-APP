// react-i18next.config.js
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'react-i18next',
      {
        useSuspense: false,
      },
    ],
  ],
};
