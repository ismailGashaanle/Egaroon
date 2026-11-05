import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { teamApi } from '../../api/teamApi';

const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

export const fetchMyTeams = createAsyncThunk('teams/fetchMine', async (_, { rejectWithValue }) => {
  try {
    const { data } = await teamApi.listMine();
    return data.data.teams;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to load teams');
  }
});

export const createTeam = createAsyncThunk('teams/create', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await teamApi.create(payload);
    return data.data.team;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to create team');
  }
});

const teamSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyTeams.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchMyTeams.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchMyTeams.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createTeam.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      });
  },
});

export default teamSlice.reducer;
