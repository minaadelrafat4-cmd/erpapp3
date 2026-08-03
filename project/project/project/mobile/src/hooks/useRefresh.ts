import { useCallback, useRef, useState } from 'react';

/**
 * Reusable pull-to-refresh state manager.
 * Pass the `refreshing` and `onRefresh` props to FlatList's
 * RefreshControl, or call `refresh` manually.
 */
export function useRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchRef.current();
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, refresh };
}
