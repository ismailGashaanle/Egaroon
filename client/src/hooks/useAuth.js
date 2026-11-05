import { useSelector } from 'react-redux';

export function useAuth() {
  const { user, status, error } = useSelector((state) => state.auth);
  return {
    user,
    role: user?.role,
    isAuthenticated: status === 'authenticated' && !!user,
    isLoading: status === 'loading' || status === 'idle',
    error,
  };
}
