import { createSlice } from '@reduxjs/toolkit';

const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('kulansiiye-theme') : null;

const initialState = {
  theme: storedTheme || 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload;
      localStorage.setItem('kulansiiye-theme', action.payload);
    },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('kulansiiye-theme', state.theme);
    },
  },
});

export const { setTheme, toggleTheme } = uiSlice.actions;
export default uiSlice.reducer;
