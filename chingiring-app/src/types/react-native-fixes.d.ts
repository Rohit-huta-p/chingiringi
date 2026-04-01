import * as React from 'react';

declare global {
  namespace JSX {
    // Override the strict ElementClass to allow React Native component classes
    interface ElementClass extends React.Component<any, any> {}
  }
}

declare module 'react-native' {
  // Patches to help TypeScript understand that RN components are valid React 19 components
  interface Text extends React.Component<any, any> {}
  interface View extends React.Component<any, any> {}
  interface ScrollView extends React.Component<any, any> {}
  interface TextInput extends React.Component<any, any> {
    focus(): void;
  }
  interface TouchableOpacity extends React.Component<any, any> {}
  interface Switch extends React.Component<any, any> {}
  interface Image extends React.Component<any, any> {}
  interface ActivityIndicator extends React.Component<any, any> {}
  interface KeyboardAvoidingView extends React.Component<any, any> {}
}
