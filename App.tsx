import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { Provider } from 'react-redux';
import store, { persistor } from './src/store/store';
import { PersistGate } from 'redux-persist/integration/react';
import { ActivityIndicator, View, StatusBar } from 'react-native';

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate
        loading={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        }
        persistor={persistor}
      >
        <NavigationContainer>
          {/* ✅ Global StatusBar for consistent theme */}
          
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <AppNavigator />
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
}
