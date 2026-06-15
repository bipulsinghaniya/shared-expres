import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBalance } from '../hooks/useBalance';
import BalanceSummary from '../components/balances/BalanceSummary';
import ExpenseBreakdown from '../components/balances/ExpenseBreakdown';
import SettlementSuggestions from '../components/balances/SettlementSuggestions';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function BalancePage() {
  const { groupId } = useParams();
  const {
    balances,
    settlements,
    breakdown,
    loading,
    stats,
    fetchBalances,
    fetchSettlements,
    fetchBreakdown,
    clearBreakdown,
  } = useBalance(groupId);

  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    await Promise.all([fetchBalances(), fetchSettlements()]);
  }, [fetchBalances, fetchSettlements]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleSelectMember = (userId) => {
    fetchBreakdown(userId);
  };

  const handleSettled = () => {
    loadAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            to={`/groups/${groupId}`}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Balances & Settlements</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Click any member to see their expense breakdown
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-8">
        {/* Balance summary */}
        <BalanceSummary
          balances={balances}
          onSelectMember={handleSelectMember}
          stats={{ ...stats, totalSettlements: settlements?.length || 0 }}
        />

        {/* Settlement suggestions */}
        <SettlementSuggestions
          settlements={settlements}
          groupId={groupId}
          onSettled={handleSettled}
        />
      </div>

      {/* Expense breakdown modal */}
      {breakdown && (
        <ExpenseBreakdown data={breakdown} onClose={clearBreakdown} />
      )}
    </div>
  );
}
