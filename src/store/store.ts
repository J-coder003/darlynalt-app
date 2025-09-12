import { configureStore, combineReducers } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import { persistReducer, persistStore } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rootReducer = combineReducers({
  auth: authReducer,
});

// Only persist what you need
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth'], // we only persist auth slice
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// NOTE: serializableCheck disabled for redux-persist’s non-serializable actions
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);

// Types
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export default store;
