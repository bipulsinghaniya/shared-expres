import { useState } from 'react';
import { ArrowRight, Check, Handshake, Loader2, IndianRupee, TrendingDown, TrendingUp } from 'lucide-react';
import { createExpense } from '../../api/expenses';
import toast from 'react-hot-toast';

export default function SettlementSuggestions({ settlements, groupId, onSettled }) {
  const [settling, setSettling] = useState(null);

  const handleMarkSettled = async (settlement) => {
    setSettling(settlement);
    try {
      const payload = {
        description: `Settlement: ${settlement.from.name} pays ${settlement.to.name}`,
        amount: settlement.amount,
        currency: 'INR',
        amountInINR: settlement.amount,
        date: new Date().toISOString().split('T')[0],
        paidBy: settlement.from.userId,
        splitType: 'EXACT',
        splitWith: [{ userId: settlement.to.userId }],
        splitDetails: [{ userId: settlement.to.userId, value: settlement.amount }],
        isSettlement: true,
        notes: 'Auto-generated settlement',
      };
      console.log('Mark Settled payload:', JSON.stringify(payload, null, 2));
      await createExpense(groupId, payload);
      toast.success(`Settlement recorded: ${settlement.from.name} → ${settlement.to.name}`);
      onSettled?.();
    } catch (err) {
      console.error('Settlement error:', err.response?.data);
      const detail = err.response?.data?.received 
        ? `\nReceived: ${JSON.stringify(err.response.data.received)}` 
        : '';
      toast.error((err.response?.data?.message || 'Failed to record settlement') + detail);
    } finally {
      setSettling(null);
    }
  };

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
      'bg-teal-500/20 text-teal-300 border-teal-500/30',
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (!settlements || settlements.length === 0) {
    return (
      <div className="glass-card p-10 text-center border border-emerald-500/15">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-inner">
          <Check className="w-7 h-7 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1 tracking-wide">All Settled!</h3>
        <p className="text-slate-400 text-sm leading-relaxed">No outstanding debts remaining in this group</p>
      </div>
    );
  }

  // Compute total amount to be settled
  const totalToSettle = settlements.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center">
            <Handshake className="w-4 h-4 text-[#7c3aed]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Suggested Settlements
            </h3>
            <p className="text-xs text-slate-400">
              {settlements.length} transaction{settlements.length !== 1 ? 's' : ''} · Total{' '}
              <span className="text-[#00d4ff] font-mono font-semibold">
                ₹{totalToSettle.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Settlement rows — full-width list for maximum clarity */}
      <div className="glass-card overflow-hidden border border-[#7c3aed]/15">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-4 px-6 py-3 bg-[#0d1424]/60 border-b border-slate-800/60">
          <span className="text-[10px] uppercase font-bold tracking-widest text-rose-400 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Who Owes
          </span>
          <span />
          <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Who Receives
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 text-right">
            Amount
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 text-right">
            Action
          </span>
        </div>

        {/* Settlement rows */}
        <div className="divide-y divide-slate-800/50">
          {settlements.map((s, idx) => {
            const isSettling =
              settling &&
              settling.from.userId === s.from.userId &&
              settling.to.userId === s.to.userId;

            const fromColor = getAvatarColor(s.from.name);
            const toColor = getAvatarColor(s.to.name);

            return (
              <div
                key={idx}
                className={`grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-4 px-6 py-4 transition-all duration-200
                  hover:bg-[#7c3aed]/5 border-l-4 border-l-transparent hover:border-l-[#7c3aed]
                  ${isSettling ? 'opacity-60' : ''}`}
              >
                {/* DEBTOR — who owes */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border flex-shrink-0 ${fromColor}`}
                  >
                    {s.from.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.from.name}</p>
                    <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      needs to pay
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0 px-1">
                  <ArrowRight className="w-5 h-5 text-[#7c3aed]" />
                </div>

                {/* CREDITOR — who receives */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border flex-shrink-0 ${toColor}`}
                  >
                    {s.to.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.to.name}</p>
                    <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      will receive
                    </p>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-extrabold text-white font-mono">
                    <span className="text-[#00d4ff] text-sm mr-0.5">₹</span>
                    {s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">INR</p>
                </div>

                {/* Action */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => handleMarkSettled(s)}
                    disabled={!!settling}
                    className="btn-success text-xs px-4 py-2 whitespace-nowrap"
                  >
                    {isSettling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Mark Settled
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer summary */}
        <div className="px-6 py-3 bg-[#0d1424]/40 border-t border-slate-800/60 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Settle all debts with {settlements.length} payment{settlements.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs font-bold text-white">
            Total outstanding:{' '}
            <span className="text-[#00d4ff] font-mono">
              ₹{totalToSettle.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
