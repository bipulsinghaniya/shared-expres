import { useState } from 'react';
import { Check, X, AlertTriangle, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

const ISSUE_COLORS = {
  DUPLICATE_ROW: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  NEGATIVE_AMOUNT: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  SETTLEMENT_AS_EXPENSE: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
  CURRENCY_MISMATCH: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  DOLLAR_AS_RUPEE: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  MEMBER_NOT_IN_GROUP: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  EXPENSE_AFTER_LEAVE: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  EXPENSE_BEFORE_JOIN: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  MISSING_FIELDS: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  INVALID_DATE: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  PERCENTAGE_NOT_100: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  EXACT_MISMATCH: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  ZERO_AMOUNT: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
  NAME_VARIANT: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
};

const ISSUE_LABELS = {
  DUPLICATE_ROW: 'Duplicate Row',
  NEGATIVE_AMOUNT: 'Negative Amount',
  SETTLEMENT_AS_EXPENSE: 'Settlement as Expense',
  CURRENCY_MISMATCH: 'Currency Mismatch',
  DOLLAR_AS_RUPEE: 'Dollar as Rupee',
  MEMBER_NOT_IN_GROUP: 'Member Not in Group',
  EXPENSE_AFTER_LEAVE: 'Expense After Leave',
  EXPENSE_BEFORE_JOIN: 'Expense Before Join',
  MISSING_FIELDS: 'Missing Fields',
  INVALID_DATE: 'Invalid Date',
  PERCENTAGE_NOT_100: 'Percentages Sum Error',
  EXACT_MISMATCH: 'Splits Mismatch',
  ZERO_AMOUNT: 'Zero Amount',
  NAME_VARIANT: 'Name Variant Spelling',
};

export default function AnomalyReviewTable({ anomalies, decisions, onDecision, onConfirm, confirming }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const totalCount = anomalies.length;
  const approvedCount = Object.values(decisions).filter((d) => d === 'approved').length;
  const rejectedCount = Object.values(decisions).filter((d) => d === 'rejected').length;
  const resolvedCount = approvedCount + rejectedCount;
  const pendingCount = totalCount - resolvedCount;
  const allResolved = totalCount > 0 && resolvedCount === totalCount;
  const resolutionPercentage = totalCount > 0 ? (resolvedCount / totalCount) * 100 : 100;

  const handleApproveAll = () => {
    anomalies.forEach((a) => onDecision(a._id, 'approved'));
  };

  const handleRejectAll = () => {
    anomalies.forEach((a) => onDecision(a._id, 'rejected'));
  };

  return (
    <div className="space-y-6">
      {/* Progress & Quick Stats Card */}
      <div className="glass-card p-6 border-t border-t-[#00d4ff]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Resolve CSV Anomalies
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Select an action for each flagged transaction to clean your ledger
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
            <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              {approvedCount} Approved
            </span>
            <span className="text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
              {rejectedCount} Rejected
            </span>
            {pendingCount > 0 && (
              <span className="text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                {pendingCount} Pending
              </span>
            )}
          </div>
        </div>

        {/* Cyan Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-400">
            <span>Anomalies resolved</span>
            <span className="text-[#00d4ff] font-bold">{resolvedCount} / {totalCount} ({Math.round(resolutionPercentage)}%)</span>
          </div>
          <div className="w-full bg-[#0d1424] rounded-full h-2.5 overflow-hidden border border-[#00d4ff]/10">
            <div
              className="bg-[#00d4ff] h-2.5 rounded-full transition-all duration-500 shadow-[0_0_8px_#00d4ff]"
              style={{ width: `${resolutionPercentage}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-800/60 justify-end">
          <button onClick={handleApproveAll} className="btn-secondary text-xs px-3.5 py-2">
            <Check className="w-3.5 h-3.5 text-emerald-400" /> Approve All
          </button>
          <button onClick={handleRejectAll} className="btn-secondary text-xs px-3.5 py-2">
            <X className="w-3.5 h-3.5 text-rose-400" /> Reject All
          </button>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {anomalies.map((a) => {
          const decision = decisions[a._id];
          const isExpanded = expandedRow === a._id;
          const badgeStyle = ISSUE_COLORS[a.issueType] || 'badge-gray';
          const badgeLabel = ISSUE_LABELS[a.issueType] || a.issueType;

          return (
            <div
              key={a._id}
              onClick={() => setExpandedRow(isExpanded ? null : a._id)}
              className={`glass-card p-4 transition-all duration-300 cursor-pointer overflow-hidden border-t-2
                ${decision === 'approved' ? 'border-t-emerald-500/60 shadow-[inset_0_0_10px_rgba(16,185,129,0.05)] bg-[#111827]/90' : ''}
                ${decision === 'rejected' ? 'border-t-rose-500/60 shadow-[inset_0_0_10px_rgba(239,68,68,0.05)] bg-[#111827]/90' : ''}
                ${!decision ? 'border-t-transparent hover:shadow-[0_0_12px_rgba(0,212,255,0.1)]' : ''}
              `}
            >
              {/* Row Header Row */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold font-mono text-slate-500 bg-[#0d1424] px-2 py-1 rounded">
                    Row #{a.rowIndex}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
                    {badgeLabel}
                  </span>
                  <span className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                    {a.rawRow.Description || '—'}
                  </span>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="text-xs font-bold font-mono text-[#00d4ff] bg-slate-900/60 px-2.5 py-1 rounded border border-[#00d4ff]/10">
                    {a.rawRow.Amount || '—'} {a.rawRow.Currency || ''}
                  </span>

                  {/* Approve/Reject Buttons */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Approve Button */}
                    <button
                      onClick={() => onDecision(a._id, 'approved')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all duration-200 border
                        ${
                          decision === 'approved'
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                            : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                        }`}
                      title="Approve"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>

                    {/* Reject Button */}
                    <button
                      onClick={() => onDecision(a._id, 'rejected')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all duration-200 border
                        ${
                          decision === 'rejected'
                            ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/20'
                            : 'border-rose-500/40 text-rose-400 hover:bg-rose-500 hover:text-white'
                        }`}
                      title="Reject"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details block */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-800/60 grid gap-4 sm:grid-cols-2 text-xs animate-fade-in-up">
                  <div className="space-y-2">
                    <p className="text-slate-400 leading-relaxed">
                      <strong className="text-white font-semibold">Issue Description:</strong><br />
                      {a.description}
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                      <strong className="text-white font-semibold">Suggested Fix:</strong><br />
                      {a.suggestedAction}
                    </p>
                  </div>

                  <div className="bg-[#0d1424] p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-white mb-2 tracking-wide uppercase text-[10px] text-[#00d4ff]">Raw Row Values</h5>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                      <div>Date: <span className="text-slate-200">{a.rawRow.Date || '—'}</span></div>
                      <div>Payer: <span className="text-slate-200">{a.rawRow.PaidBy || '—'}</span></div>
                      <div>Split: <span className="text-slate-200">{a.rawRow.SplitType || '—'}</span></div>
                      <div>Details: <span className="text-slate-200">{a.rawRow.SplitDetails || '—'}</span></div>
                      <div className="col-span-2">Notes: <span className="text-slate-200">{a.rawRow.Notes || '—'}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm Import Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80 pt-6">
        <div>
          {!allResolved && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Resolve all {pendingCount} pending anomalies before confirming
            </p>
          )}
        </div>

        <button
          onClick={onConfirm}
          disabled={!allResolved || confirming}
          className={`w-full sm:w-auto px-6 py-3 font-bold text-sm tracking-wide rounded-xl flex items-center justify-center gap-2 transition-all duration-300
            ${
              confirming
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : allResolved
                ? 'btn-primary animate-pulse-glow hover:brightness-110'
                : 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed'
            }`}
        >
          {confirming ? (
            <div className="w-5 h-5 border-2 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Confirm & Import ({approvedCount} approved)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
