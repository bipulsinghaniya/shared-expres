import { useAuth } from '../../hooks/useAuth';
import { TrendingUp, TrendingDown, Minus, ChevronRight, Receipt, Wallet, Handshake } from 'lucide-react';

export default function BalanceSummary({ balances, onSelectMember, stats }) {
  const { user } = useAuth();

  // Color hash algorithm for avatars based on member name
  const getAvatarColor = (name) => {
    const colors = [
      'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'bg-amber-500/20 text-amber-300 border-amber-500/30',
      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      'bg-violet-500/20 text-violet-300 border-violet-500/30',
      'bg-cyan-500/20 text-[#00d4ff] border-cyan-500/30',
      'bg-rose-500/20 text-rose-300 border-rose-500/30',
      'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'bg-teal-500/20 text-teal-300 border-teal-500/30'
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Compute stats locally based on balances
  const totalGroupSpend = balances.reduce((sum, b) => sum + (b.totalPaid || 0), 0);
  const myBalanceEntry = balances.find(
    (b) => String(b.userId) === String(user?._id || user?.id)
  );
  const myBalanceVal = myBalanceEntry ? myBalanceEntry.balance : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Total Spend Card */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7c3aed] to-[#00d4ff]" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Spent</span>
            <Receipt className="w-4 h-4 text-[#00d4ff] opacity-80" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">
            <span className="text-[#00d4ff] font-mono mr-1">₹</span>
            <span className="monospace-amount">
              {totalGroupSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </h3>
        </div>

        {/* Your Balance Card */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7c3aed] to-[#00d4ff]" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Balance</span>
            <Wallet className={`w-4 h-4 opacity-80 ${myBalanceVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
          <h3 className={`text-2xl font-extrabold ${myBalanceVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span className="font-mono mr-1">{myBalanceVal >= 0 ? '+' : '-'}₹</span>
            <span className="monospace-amount">
              {Math.abs(myBalanceVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </h3>
        </div>

        {/* Settlements Needed Card */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7c3aed] to-[#00d4ff]" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Settlements</span>
            <Handshake className="w-4 h-4 text-[#7c3aed] opacity-80" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">
            <span className="monospace-amount text-[#7c3aed]">
              {stats.totalSettlements || 0}
            </span> Suggestions
          </h3>
        </div>
      </div>

      {/* Net Balances List */}
      <div className="glass-card overflow-hidden border border-[#00d4ff]/15">
        <div className="px-6 py-5 border-b border-[#00d4ff]/15 bg-[#0d1424]/40 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Net Balances</h3>
            <p className="text-xs text-slate-400 mt-1">Click a member to inspect their expense breakdown</p>
          </div>
        </div>

        <div className="divide-y divide-slate-800/60">
          {balances.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No balance data available
            </div>
          ) : (
            balances.map((b) => {
              const isPositive = b.balance > 0.01;
              const isNegative = b.balance < -0.01;
              const isZero = !isPositive && !isNegative;
              const avatarColor = getAvatarColor(b.name);

              return (
                <button
                  key={b.userId}
                  onClick={() => onSelectMember(b.userId)}
                  className="w-full flex items-center gap-4 px-6 py-4.5 hover:bg-[#00d4ff]/5 transition-all duration-200 text-left group border-l-4 border-l-transparent hover:border-l-[#00d4ff]"
                >
                  {/* Avatar circle */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base border flex-shrink-0 ${avatarColor}`}>
                    {b.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white group-hover:text-[#00d4ff] transition-colors">
                      {b.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{b.email}</p>
                  </div>

                  {/* Paid / Owed Breakdown */}
                  <div className="hidden sm:block text-right mr-6">
                    <p className="text-xs text-slate-400 leading-normal">
                      Paid: <span className="text-slate-200 font-medium font-mono">₹{b.totalPaid?.toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-slate-400 leading-normal">
                      Share: <span className="text-slate-200 font-medium font-mono">₹{b.totalOwed?.toFixed(2)}</span>
                    </p>
                  </div>

                  {/* Net balance */}
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {isPositive && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                    {isNegative && <TrendingDown className="w-4 h-4 text-rose-400" />}
                    {isZero && <Minus className="w-4 h-4 text-slate-500" />}
                    <span
                      className={`text-base font-extrabold monospace-amount
                        ${isPositive ? 'text-emerald-400' : ''}
                        ${isNegative ? 'text-rose-400' : ''}
                        ${isZero ? 'text-slate-500' : ''}
                      `}
                    >
                      {isPositive ? '+' : ''}₹
                      {Math.abs(b.balance).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-[#00d4ff] transition-colors flex-shrink-0 ml-2" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
