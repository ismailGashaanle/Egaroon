import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '../../api/authApi';
import { setAccessToken } from '../../api/axiosClient';

const initialState = {
  user: null,
  status: 'idle', // idle | loading | authenticated | guest
  error: null,
};

export const registerUser = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await authApi.register(payload);
    setAccessToken(data.data.accessToken);
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Registration failed');
  }
});

export const loginUser = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await authApi.login(payload);
    // Demo deployments ask for a sample code before a session is issued.
    if (data.data.twoFactorRequired) return { twoFactor: true, challenge: data.data.challenge };
    setAccessToken(data.data.accessToken);
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Invalid email or password');
  }
});

export const verifyLoginCode = createAsyncThunk('auth/verifyLoginCode', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await authApi.verifyLoginCode(payload);
    setAccessToken(data.data.accessToken);
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'That code is not correct');
  }
});

export const oauthExchange = createAsyncThunk('auth/oauthExchange', async (code, { rejectWithValue }) => {
  try {
    const { data } = await authApi.oauthExchange(code);
    setAccessToken(data.data.accessToken);
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Google sign-in failed');
  }
});

// Attempts to restore a session on app load using the httpOnly refresh
// cookie — no access token is stored client-side between reloads.
export const restoreSession = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authApi.refresh();
    setAccessToken(data.data.accessToken);
    const me = await authApi.me();
    return me.data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message);
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } finally {
    setAccessToken(null);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionExpired(state) {
      state.user = null;
      state.status = 'guest';
    },
    setUser(state, action) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'guest';
        state.error = action.payload;
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        if (action.payload?.twoFactor) {
          state.status = 'guest'; // password accepted, waiting for the code
          return;
        }
        state.status = 'authenticated';
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'guest';
        state.error = action.payload;
      })
      .addCase(verifyLoginCode.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(verifyLoginCode.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload;
      })
      .addCase(verifyLoginCode.rejected, (state, action) => {
        state.status = 'guest';
        state.error = action.payload;
      })
      .addCase(oauthExchange.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(oauthExchange.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload;
      })
      .addCase(oauthExchange.rejected, (state, action) => {
        state.status = 'guest';
        state.error = action.payload;
      })
      .addCase(restoreSession.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = 'guest';
        state.user = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = 'guest';
        state.user = null;
      });
  },
});

export const { sessionExpired, setUser } = authSlice.actions;
export default authSlice.reducer;
