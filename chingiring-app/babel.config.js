module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-adds react-native-worklets/plugin (Reanimated 4's
    // worklets transform) when react-native-worklets is installed — do NOT add it
    // manually here, or the transform runs twice and worklets break at runtime.
    presets: ['babel-preset-expo'],
  };
};
