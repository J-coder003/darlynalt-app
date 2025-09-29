import React from 'react';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

export type Role = 'customer' | 'worker';

export interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: Role;
  phoneNumber?: string;
  additionalPhoneNumber?: string;
  [key: string]: any; 
}

interface AuthState {
  user: User | null;
  userId: string | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  userId: null,
  token: null,
  loading: false,
  error: null,
};

/**
 * 🔹 Normalize Mongo _id → id
 */
const normalizeUser = (user: any): User => ({
  ...user,
  id: user._id ?? user.id,
});

/**
 * 🔹 Login
 */
export const loginUser = createAsyncThunk<
  { token: string; user: User },
  { email: string; password: string },
  { rejectValue: string }
>('auth/loginUser', async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/login', { email, password });
    const { access_token } = res.data;

    await AsyncStorage.setItem('token', access_token);

    const userRes = await api.get('/users/me');
    const user = normalizeUser(userRes.data);

    if (user.id) {
      await AsyncStorage.setItem('userId', user.id);
    }

    return { token: access_token, user };
  } catch (err: any) {
    return rejectWithValue(err?.response?.data?.message || 'Login failed');
  }
});

/**
 * 🔹 Signup
 */
export const signupUser = createAsyncThunk<
  { token: string; user: User },
  {
    name: string;
    email: string;
    password: string;
    role: Role;
    phoneNumber: string;              // ✅ required
    additionalPhoneNumber?: string;   // ✅ optional
  },
  { rejectValue: string }
>(
  'auth/signupUser',
  async (
    { name, email, password, role, phoneNumber, additionalPhoneNumber },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.post('/auth/signup', {
        name,
        email,
        password,
        role,
        phoneNumber,
        additionalPhoneNumber,
      });
      const { access_token } = res.data;

      await AsyncStorage.setItem('token', access_token);

      const userRes = await api.get('/users/me');
      const user = normalizeUser(userRes.data);

      if (user.id) {
        await AsyncStorage.setItem('userId', user.id);
      }

      return { token: access_token, user };
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Signup failed');
    }
  }
);

/**
 * 🔹 Restore user session
 */
export const loadUserFromStorage = createAsyncThunk<
  { token: string; user: User; userId: string },
  void,
  { rejectValue: string }
>('auth/loadUserFromStorage', async (_, { rejectWithValue }) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const userId = await AsyncStorage.getItem('userId');

    if (!token || !userId) return rejectWithValue('No session found');

    const res = await api.get('/users/me');
    const user = normalizeUser(res.data);

    if (user.id) {
      await AsyncStorage.setItem('userId', user.id);
    }

    return { token, user, userId: user.id || userId };
  } catch {
    return rejectWithValue('Failed to restore session');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.userId = null;
      state.token = null;
      state.error = null;
      AsyncStorage.multiRemove(['token', 'userId']).catch(() => {});
    },
    setUser(state, action: PayloadAction<{ user: User; token?: string }>) {
      const { user, token } = action.payload;
      const normalizedUser = normalizeUser(user);

      state.user = normalizedUser;
      state.userId = normalizedUser.id || null;
      if (token) state.token = token;

      if (state.userId) {
        AsyncStorage.setItem('userId', state.userId).catch(() => {});
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.userId = action.payload.user.id || null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Login failed';
      })
      .addCase(signupUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.userId = action.payload.user.id || null;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Signup failed';
      })
      .addCase(loadUserFromStorage.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadUserFromStorage.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.userId = action.payload.userId;
      })
      .addCase(loadUserFromStorage.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.userId = null;
        state.token = null;
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
