import { useState, useCallback } from 'react';
import { getBalances, getMemberBreakdown, getSettlements } from '../api/balances';

export function useBalance(groupId) {
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalExpenses: 0, totalSettlements: 0 });

  const fetchBalances = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await getBalances(groupId);
      setBalances(res.data.balances || []);
      setStats({
        totalExpenses: res.data.totalExpenses || 0,
        totalSettlements: res.data.totalSettlements || 0,
      });
    } catch {
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchSettlements = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await getSettlements(groupId);
      setSettlements(res.data.settlements || []);
    } catch {
      setSettlements([]);
    }
  }, [groupId]);

  const fetchBreakdown = useCallback(async (userId) => {
    if (!groupId || !userId) return;
    try {
      const res = await getMemberBreakdown(groupId, userId);
      setBreakdown(res.data);
    } catch {
      setBreakdown(null);
    }
  }, [groupId]);

  const clearBreakdown = useCallback(() => setBreakdown(null), []);

  return {
    balances,
    settlements,
    breakdown,
    loading,
    stats,
    fetchBalances,
    fetchSettlements,
    fetchBreakdown,
    clearBreakdown,
  };
}
