import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import { getGroup, addMember, updateMember } from '../api/groups';
import { getExpenses, deleteExpense } from '../api/expenses';
import { uploadCSV, confirmImport } from '../api/imports';
import { format } from 'date-fns';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import {
  Users,
  Receipt,
  BarChart3,
  Upload,
  Plus,
  Trash2,
  X,
  ArrowRight,
  UserPlus,
  UserMinus,
  Filter,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import ExpenseForm from '../components/expenses/ExpenseForm';
import BalanceSummary from '../components/balances/BalanceSummary';
import SettlementSuggestions from '../components/balances/SettlementSuggestions';
import AnomalyReviewTable from '../components/import/AnomalyReviewTable';
import ImportReport from '../components/import/ImportReport';

const TABS = [
  { id: 'members', label: 'Members', icon: Users },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'balances', label: 'Balances', icon: BarChart3 },
  { id: 'import', label: 'Import', icon: Upload },
];

export default function GroupPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  
  // Custom Hook for Balance computations
  const {
    balances,
    settlements,
    breakdown,
    stats: balanceStats,
    fetchBalances,
    fetchSettlements,
    fetchBreakdown,
    clearBreakdown,
  } = useBalance(groupId);

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(null);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', joinDate: '' });
  const [leaveDate, setLeaveDate] = useState('');
  const [filters, setFilters] = useState({ paidBy: '', splitType: '', startDate: '', endDate: '' });
  const [showFilters, setShowFilters] = useState(false);

  // Import State Variables
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importData, setImportData] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importStep, setImportStep] = useState('upload'); // 'upload' | 'review' | 'done'

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

  const fetchData = useCallback(async () => {
    try {
      const [groupRes, expRes] = await Promise.all([
        getGroup(groupId),
        getExpenses(groupId),
      ]);
      setGroup(groupRes.data.group);
      setMembers(groupRes.data.members || []);
      setExpenses(expRes.data.expenses || []);
    } catch {
      toast.error('Failed to load group data');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch balances/settlements whenever the active tab becomes "balances"
  useEffect(() => {
    if (activeTab === 'balances') {
      fetchBalances();
      fetchSettlements();
    }
  }, [activeTab, fetchBalances, fetchSettlements]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await addMember(groupId, {
        name: memberForm.name,
        email: memberForm.email,
        joinDate: memberForm.joinDate || new Date().toISOString(),
      });
      toast.success('Member added!');
      setShowAddMember(false);
      setMemberForm({ name: '', email: '', joinDate: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleSetLeaveDate = async () => {
    if (!showLeaveModal || !leaveDate) return;
    try {
      await updateMember(groupId, showLeaveModal.userId._id || showLeaveModal.userId, {
        leaveDate,
      });
      toast.success('Leave date updated');
      setShowLeaveModal(null);
      setLeaveDate('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!confirm('Delete this expense? It can be recovered later.')) return;
    try {
      await deleteExpense(groupId, expId);
      toast.success('Expense deleted');
      fetchData();
      // Refetch balances if we are on balances view
      if (activeTab === 'balances') {
        fetchBalances();
        fetchSettlements();
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  // CSV Dropzone configuration
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: uploading,
  });

  const handleUpload = async () => {
    if (!file) {
      toast.error('Select a CSV file first');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadCSV(groupId, file);
      const { importLog, summary } = res.data;
      setImportData({
        importLogId: importLog.id,
        anomalies: importLog.anomalies || [],
        summary,
        parsedRows: importLog.parsedRows || [],
      });
      setDecisions({});
      setImportStep('review');
      toast.success(`Parsed ${summary.totalRows} rows — review anomalies`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to parse CSV');
    } finally {
      setUploading(false);
    }
  };

  const handleDecision = (anomalyId, status) => {
    setDecisions((prev) => ({ ...prev, [anomalyId]: status }));
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const resolutions = Object.entries(decisions).map(([anomalyId, status]) => {
        const anomaly = importData.anomalies.find((a) => String(a._id) === String(anomalyId));
        return {
          rowIndex: anomaly ? anomaly.rowIndex : null,
          action: status === 'approved' ? 'APPROVE' : 'SKIP',
        };
      }).filter((r) => r.rowIndex !== null);

      const res = await confirmImport(groupId, importData.importLogId, resolutions);
      
      setImportResult({
        totalRows: importData.summary.totalRows,
        imported: res.data.importedCount,
        skipped: res.data.skippedCount,
        errors: importData.summary.errorCount,
      });
      setImportStep('done');
      toast.success(res.data.message || `Import complete! ${res.data.importedCount} expenses imported.`);
      fetchData(); // Refresh group expenses list
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to confirm import';
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setImportData(null);
    setDecisions({});
    setImportResult(null);
    setImportStep('upload');
  };

  const filteredExpenses = expenses.filter((exp) => {
    if (filters.paidBy && String(exp.paidBy._id || exp.paidBy) !== filters.paidBy) return false;
    if (filters.splitType && exp.splitType !== filters.splitType) return false;
    if (filters.startDate && new Date(exp.date) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(exp.date) > new Date(filters.endDate)) return false;
    return true;
  });

  // Calculate stats for Balances summary card
  const totalSpentInGroup = expenses.reduce((sum, e) => sum + (e.isDeleted || e.isSettlement ? 0 : e.amountInINR), 0);
  const myBalanceEntry = balances.find(b => String(b.userId) === String(user?._id || user?.id));
  const myBalanceVal = myBalanceEntry ? myBalanceEntry.balance : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return <div className="text-center py-20 text-slate-500">Group not found</div>;
  }

  return (
    <div className="animate-fade-in-up">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">{group.name}</h1>
        {group.description && (
          <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">{group.description}</p>
        )}
      </div>

      {/* Pill-style Tabs */}
      <div className="flex gap-1 p-1 bg-[#0d1424] rounded-xl border border-[#00d4ff]/15 mb-8 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap
              ${
                activeTab === tab.id
                  ? 'bg-[#00d4ff] text-[#0a0f1e] shadow-lg shadow-[#00d4ff]/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- MEMBERS TAB --- */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white tracking-wide">
              Group Members ({members.length})
            </h2>
            <button onClick={() => setShowAddMember(true)} className="btn-primary text-sm">
              <UserPlus className="w-4 h-4" /> Add Member
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => {
              const memberName = m.userId?.name || 'Unknown';
              const isActive = !m.leaveDate || new Date(m.leaveDate) >= new Date();
              return (
                <div key={m._id} className="glass-card p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar circle based on unique name hash */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base border flex-shrink-0 ${getAvatarColor(memberName)}`}>
                      {memberName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{memberName}</p>
                      <p className="text-xs text-slate-400 truncate">{m.userId?.email || '—'}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                        Joined: {m.joinDate ? format(new Date(m.joinDate), 'MMM d, yyyy') : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        Left on {format(new Date(m.leaveDate), 'MMM d')}
                      </span>
                    )}

                    {isActive && (
                      <button
                        onClick={() => { setShowLeaveModal(m); setLeaveDate(''); }}
                        className="text-[10px] font-bold text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                      >
                        <UserMinus className="w-3 h-3" /> Set leave date
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Member Modal */}
          {showAddMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddMember(false)} />
              <div className="relative glass-card p-6 w-full max-w-md border-t-2 border-t-[#00d4ff] animate-scale-in">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white tracking-wide">Add Group Member</h2>
                  <button onClick={() => setShowAddMember(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div>
                    <label className="label-text">Name</label>
                    <input type="text" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} placeholder="e.g. Sam" required className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Email</label>
                    <input type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="sam@example.com" required className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Join Date</label>
                    <input type="date" value={memberForm.joinDate} onChange={(e) => setMemberForm({ ...memberForm, joinDate: e.target.value })} className="input-field" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary flex-1">Cancel</button>
                    <button type="submit" className="btn-primary flex-1"><UserPlus className="w-4 h-4" /> Add Member</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Leave Date Modal */}
          {showLeaveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLeaveModal(null)} />
              <div className="relative glass-card p-6 w-full max-w-sm border-t-2 border-t-rose-500 animate-scale-in">
                <h2 className="text-lg font-bold text-white mb-4">
                  Set Leave Date for {showLeaveModal.userId?.name}
                </h2>
                <input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} className="input-field mb-4" />
                <div className="flex gap-3">
                  <button onClick={() => setShowLeaveModal(null)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleSetLeaveDate} disabled={!leaveDate} className="btn-danger flex-1">
                    <UserMinus className="w-4 h-4" /> Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- EXPENSES TAB --- */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-bold text-white tracking-wide">
              Expense History ({filteredExpenses.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn-secondary text-sm ${showFilters ? 'border-[#00d4ff]/40 text-[#00d4ff]' : ''}`}
              >
                <Filter className="w-4 h-4" /> Filters
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={() => setShowExpenseForm(true)} className="btn-primary text-sm">
                <Plus className="w-4 h-4" /> Add Expense
              </button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-fade-in-up">
              <div>
                <label className="label-text text-xs">Paid By</label>
                <select value={filters.paidBy} onChange={(e) => setFilters({ ...filters, paidBy: e.target.value })} className="input-field text-sm">
                  <option value="">All Members</option>
                  {members.map((m) => (
                    <option key={m.userId._id || m.userId} value={m.userId._id || m.userId}>
                      {m.userId.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text text-xs">Split Type</label>
                <select value={filters.splitType} onChange={(e) => setFilters({ ...filters, splitType: e.target.value })} className="input-field text-sm">
                  <option value="">All Splits</option>
                  <option value="EQUAL">Equal</option>
                  <option value="EXACT">Exact</option>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="SHARES">Shares</option>
                </select>
              </div>
              <div>
                <label className="label-text text-xs">From Date</label>
                <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="input-field text-sm" />
              </div>
              <div>
                <label className="label-text text-xs">To Date</label>
                <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="input-field text-sm" />
              </div>
            </div>
          )}

          {/* Expenses list */}
          <div className="space-y-4">
            {filteredExpenses.length === 0 ? (
              <div className="glass-card p-12 text-center text-slate-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-600 opacity-60" />
                No expenses logged yet
              </div>
            ) : (
              filteredExpenses.map((exp) => (
                <div
                  key={exp._id}
                  className="glass-card p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-all duration-300 border-t border-t-slate-800"
                >
                  <div className="flex items-start gap-4">
                    {/* Payer Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border flex-shrink-0 ${getAvatarColor(exp.paidBy?.name)}`}>
                      {exp.paidBy?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h4 className="text-lg font-bold text-white leading-tight">{exp.description}</h4>
                        {exp.isSettlement && <span className="badge-purple">Settlement</span>}
                        <span className={
                          exp.splitType === 'EQUAL' ? 'badge-cyan' :
                          exp.splitType === 'EXACT' ? 'badge-purple' :
                          exp.splitType === 'PERCENTAGE' ? 'badge-amber' :
                          'badge-emerald' // SHARES
                        }>
                          {exp.splitType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Paid by <span className="text-white font-medium">{exp.paidBy?.name || 'Unknown'}</span>
                        {' · '}
                        {format(new Date(exp.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <span className="text-[#00d4ff] font-bold text-xl mr-1 font-mono">₹</span>
                      <span className="text-2xl font-extrabold text-white monospace-amount">
                        {exp.amountInINR?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      {exp.currency === 'USD' && (
                        <p className="text-xs text-slate-400 font-mono">
                          <span className="text-[#00d4ff]">$</span>{exp.amount?.toFixed(2)}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteExpense(exp._id)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- BALANCES TAB --- */}
      {activeTab === 'balances' && (
        <div className="space-y-8 animate-fade-in-up">

          {/* Balance summary list and suggestion cards */}
          <BalanceSummary
            balances={balances}
            onSelectMember={fetchBreakdown}
            stats={{ ...balanceStats, totalSettlements: settlements?.length || 0 }}
          />

          <SettlementSuggestions
            settlements={settlements}
            groupId={groupId}
            onSettled={() => {
              fetchBalances();
              fetchSettlements();
            }}
          />

          {breakdown && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={clearBreakdown} />
              <div className="relative glass-card p-6 w-full max-w-3xl border-t-2 border-t-[#00d4ff] max-h-[85vh] overflow-y-auto animate-scale-in">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white tracking-wide">Expense Breakdown</h2>
                  <button onClick={clearBreakdown} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {breakdown.breakdown?.length === 0 ? (
                    <p className="text-slate-400 text-center py-6">No expenses found for this user.</p>
                  ) : (
                    breakdown.breakdown?.map((item) => (
                      <div key={item.expenseId} className="flex justify-between items-center p-3.5 bg-slate-900/60 rounded-xl border border-slate-800/40">
                        <div>
                          <p className="text-sm font-bold text-white">{item.description}</p>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">
                            {format(new Date(item.date), 'MMM d, yyyy')} · Split: {item.splitType}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Paid: ₹{item.paidAmount?.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">Share: ₹{item.owedAmount?.toFixed(2)}</p>
                          <p className={`text-sm font-bold font-mono mt-0.5 ${item.netEffect >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.netEffect >= 0 ? '+' : '-'}₹{Math.abs(item.netEffect).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- IMPORT TAB --- */}
      {activeTab === 'import' && (
        <div className="space-y-6 animate-fade-in-up">
          <h2 className="text-lg font-bold text-white tracking-wide">CSV Expense Importer</h2>
          
          {/* Progress Steps Indicator */}
          <div className="flex items-center gap-2 mb-8 max-w-lg mx-auto">
            {['Upload', 'Review', 'Done'].map((label, idx) => {
              const stepIdx = ['upload', 'review', 'done'].indexOf(importStep);
              const isActive = idx === stepIdx;
              const isDone = idx < stepIdx;
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                      ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isActive
                          ? 'bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30'
                          : 'bg-slate-800 text-slate-600 border border-slate-700'
                      }`}
                  >
                    {idx + 1}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:block ${
                      isActive ? 'text-[#00d4ff]' : isDone ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  >
                    {label}
                  </span>
                  {idx < 2 && (
                    <div className={`flex-1 h-px ${isDone ? 'bg-emerald-500/30' : 'bg-slate-800'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 1: Upload */}
          {importStep === 'upload' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
                  ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                  ${
                    isDragActive
                      ? 'border-[#00d4ff] bg-[#00d4ff]/10 scale-[1.02]'
                      : file
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-[#00d4ff]/30 hover:border-[#00d4ff] hover:bg-[#00d4ff]/5'
                  }`}
              >
                <input {...getInputProps()} />

                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                      <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    {!uploading && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors mt-2"
                      >
                        <X className="w-3.5 h-3.5" /> Remove file
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center shadow-inner">
                      <Upload className="w-7 h-7 text-[#00d4ff]" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">
                        {isDragActive ? (
                          <span className="text-[#00d4ff] font-bold">Drop your CSV here...</span>
                        ) : (
                          <>
                            <span className="text-[#00d4ff] font-bold">Click to browse</span> or drag and drop
                          </>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">CSV files only, up to 5MB</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="btn-primary"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing spreadsheet...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Analyze
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {importStep === 'review' && importData && (
            <div className="space-y-6">
              {/* Quick Summary Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="glass-card p-4">
                  <p className="text-2xl font-extrabold text-white monospace-amount">{importData.summary.totalRows}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Rows</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-2xl font-extrabold text-emerald-400 monospace-amount">{importData.summary.successCount}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Valid Rows</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-2xl font-extrabold text-rose-400 monospace-amount">{importData.summary.errorCount}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Error Rows</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-2xl font-extrabold text-amber-400 monospace-amount">{importData.summary.anomalyCount}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Anomalies</p>
                </div>
              </div>

              <AnomalyReviewTable
                anomalies={importData.anomalies}
                decisions={decisions}
                onDecision={handleDecision}
                onConfirm={handleConfirm}
                confirming={confirming}
              />
            </div>
          )}

          {/* Step 3: Done */}
          {importStep === 'done' && (
            <div className="space-y-6 max-w-xl mx-auto">
              <ImportReport summary={importResult} />
              <div className="flex justify-center gap-4">
                <button onClick={resetImport} className="btn-secondary">
                  Import Another CSV
                </button>
                <button onClick={() => setActiveTab('expenses')} className="btn-primary">
                  View Expenses
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <ExpenseForm
          groupId={groupId}
          members={members}
          onClose={() => setShowExpenseForm(false)}
          onCreated={() => {
            fetchData();
            if (activeTab === 'balances') {
              fetchBalances();
              fetchSettlements();
            }
          }}
        />
      )}
    </div>
  );
}
