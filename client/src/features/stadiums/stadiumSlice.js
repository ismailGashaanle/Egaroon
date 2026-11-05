import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { stadiumApi } from '../../api/stadiumApi';

const initialState = {
  items: [],
  meta: null,
  status: 'idle',
  error: null,
  filters: { city: '', region: '', area: '' },
};

export const fetchStadiums = createAsyncThunk('stadiums/fetch', async (params, { rejectWithValue }) => {
  try {
    const { data } = await stadiumApi.list(params);
    return {
      stadiums: data.data.stadiums || [],
      meta: data.data.meta || null,
    };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to load stadiums');
  }
});

const stadiumSlice = createSlice({
  name: 'stadiums',
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStadiums.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchStadiums.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.stadiums;
        state.meta = action.payload.meta;
      })
      .addCase(fetchStadiums.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { setFilters } = stadiumSlice.actions;
export default stadiumSlice.reducer;
