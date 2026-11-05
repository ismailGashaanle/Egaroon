import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import uiReducer from '../features/ui/uiSlice';
import teamReducer from '../features/teams/teamSlice';
import stadiumReducer from '../features/stadiums/stadiumSlice';
import bookingReducer from '../features/bookings/bookingSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    teams: teamReducer,
    stadiums: stadiumReducer,
    bookings: bookingReducer,
  },
});

export default store;
