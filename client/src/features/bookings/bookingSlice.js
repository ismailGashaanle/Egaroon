import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { bookingApi } from '../../api/bookingApi';

const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

export const fetchMyBookings = createAsyncThunk('bookings/fetchMine', async (_, { rejectWithValue }) => {
  try {
    const { data } = await bookingApi.listMine();
    return data.data.bookings;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to load bookings');
  }
});

export const createBooking = createAsyncThunk('bookings/create', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await bookingApi.create(payload);
    return data.data.booking;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error?.message || 'Failed to create booking');
  }
});

// Real-time update pushed via Socket.IO — merges the latest booking state
// into the list without a full refetch.
function upsertBooking(state, booking) {
  const idx = state.items.findIndex((b) => b._id === booking._id);
  if (idx >= 0) state.items[idx] = booking;
  else state.items.unshift(booking);
}

const bookingSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    bookingUpdated(state, action) {
      upsertBooking(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyBookings.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchMyBookings.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchMyBookings.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      });
  },
});

export const { bookingUpdated } = bookingSlice.actions;
export default bookingSlice.reducer;
