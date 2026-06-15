import { X, TrendingUp, TrendingDown, IndianRupee, Handshake, Receipt } from 'lucide-react';
import { format } from 'date-fns';

export default function ExpenseBreakdown({ data, onClose }) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card w-full max-w-2xl max-h-[85vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800/50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">
              {data.memberName}&apos;s Breakdown
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {data.expenseCount} expenses · Net:{' '}
              <span className={data.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {data.netBalance >= 0 ? '+' : ''}₹
                {Math.abs(data.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 p-6 border-b border-gray-800/50 flex-shrink-0">
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400">
              ₹{data.totalPaid?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500">Total Paid</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-rose-400">
              ₹{data.totalOwed?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500">Total Owed</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${data.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.netBalance >= 0 ? '+' : ''}₹
              {Math.abs(data.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500">Net Balance</p>
          </div>
        </div>

        {/* Expense list */}
        <div className="flex-1 overflow-y-auto p-6">
          {data.breakdown && data.breakdown.length > 0 ? (
            <div className="space-y-2">
              {data.breakdown.map((item, idx) => (
                <div
                  key={item.expenseId || idx}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                      ${item.isSettlement ? 'bg-violet-500/15 border border-violet-500/20' : 'bg-brand-500/15 border border-brand-500/20'}`}
                  >
                    {item.isSettlement ? (
                      <Handshake className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Receipt className="w-4 h-4 text-brand-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.description}</p>
                    <p className="text-xs text-gray-500">
                      {item.date ? format(new Date(item.date), 'MMM d, yyyy') : '—'}
                      {' · '}
                      {item.isPayer ? 'Paid' : `Paid by ${item.paidByName}`}
                      {item.isSettlement && ' · Settlement'}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0 space-y-0.5">
                    {item.isPayer && (
                      <p className="text-xs text-emerald-400 flex items-center justify-end gap-0.5">
                        <TrendingUp className="w-3 h-3" /> +₹{item.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    {item.owedAmount > 0 && (
                      <p className="text-xs text-rose-400 flex items-center justify-end gap-0.5">
                        <TrendingDown className="w-3 h-3" /> -₹{item.owedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    <p className={`text-xs font-semibold ${item.netEffect >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      Net: {item.netEffect >= 0 ? '+' : ''}₹{Math.abs(item.netEffect).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No expenses found for this member</p>
          )}
        </div>
      </div>
    </div>
  );
}
