import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, Plus, DollarSign, IndianRupee, Calendar, Users } from 'lucide-react';
import { createExpense } from '../../api/expenses';

const SPLIT_TYPES = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'];
const USD_TO_INR = 83.5;

export default function ExpenseForm({ groupId, members, onClose, onCreated }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    date: new Date().toISOString().split('T')[0],
    paidBy: '',
    splitType: 'EQUAL',
    isSettlement: false,
    notes: '',
  });
  const [splitDetails, setSplitDetails] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeMembers, setActiveMembers] = useState([]);

  // Filter active members based on selected date
  useEffect(() => {
    if (!form.date) {
      setActiveMembers(members);
      return;
    }
    const expDate = new Date(form.date);
    const active = members.filter((m) => {
      const join = new Date(m.joinDate);
      if (expDate < join) return false;
      if (m.leaveDate) {
        const leave = new Date(m.leaveDate);
        if (expDate > leave) return false;
      }
      return true;
    });
    setActiveMembers(active);
  }, [form.date, members]);

  // Initialize split details when split type or active members change
  useEffect(() => {
    if (form.splitType === 'EQUAL') {
      setSplitDetails([]);
      return;
    }
    const details = activeMembers.map((m) => ({
      userId: m.userId._id || m.userId,
      name: m.userId.name || 'Unknown',
      amount: '',
      percentage: '',
      shares: '',
    }));
    setSplitDetails(details);
  }, [form.splitType, activeMembers]);

  const convertedAmount =
    form.currency === 'USD' && form.amount
      ? (parseFloat(form.amount) * USD_TO_INR).toFixed(2)
      : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.paidBy) {
      toast.error('Select who paid');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        date: form.date,
        paidBy: form.paidBy,
        splitType: form.splitType,
        isSettlement: form.isSettlement,
        notes: form.notes,
      };

      if (form.splitType === 'EXACT') {
        payload.splitDetails = splitDetails.map((s) => ({
          userId: s.userId,
          amount: parseFloat(s.amount) || 0,
        }));
      } else if (form.splitType === 'PERCENTAGE') {
        payload.splitDetails = splitDetails.map((s) => ({
          userId: s.userId,
          percentage: parseFloat(s.percentage) || 0,
        }));
      } else if (form.splitType === 'SHARES') {
        payload.splitDetails = splitDetails.map((s) => ({
          userId: s.userId,
          shares: parseFloat(s.shares) || 0,
        }));
      }

      await createExpense(groupId, payload);
      toast.success('Expense added!');
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const updateSplit = (index, field, value) => {
    const updated = [...splitDetails];
    updated[index] = { ...updated[index], [field]: value };
    setSplitDetails(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {form.isSettlement ? 'Record Settlement' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Settlement toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isSettlement}
              onChange={(e) => setForm({ ...form, isSettlement: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand-500 focus:ring-brand-500/20"
            />
            <span className="text-sm text-gray-300">This is a settlement payment</span>
          </label>

          {/* Description */}
          <div>
            <label className="label-text">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g., Groceries, Rent, Netflix"
              required
              className="input-field"
            />
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label-text">Amount</label>
              <div className="relative">
                {form.currency === 'INR' ? (
                  <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                ) : (
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                )}
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  required
                  className="input-field pl-10"
                />
              </div>
              {convertedAmount && (
                <p className="text-xs text-brand-400 mt-1.5 flex items-center gap-1">
                  <IndianRupee className="w-3 h-3" />
                  ≈ ₹{convertedAmount} INR (rate: {USD_TO_INR})
                </p>
              )}
            </div>
            <div>
              <label className="label-text">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="input-field"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="label-text flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="input-field"
            />
          </div>

          {/* Paid By */}
          <div>
            <label className="label-text flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Paid By
              <span className="text-xs text-gray-600 ml-1">
                ({activeMembers.length} active on this date)
              </span>
            </label>
            <select
              value={form.paidBy}
              onChange={(e) => setForm({ ...form, paidBy: e.target.value })}
              required
              className="input-field"
            >
              <option value="">Select payer...</option>
              {activeMembers.map((m) => (
                <option key={m.userId._id || m.userId} value={m.userId._id || m.userId}>
                  {m.userId.name || 'Unknown'}
                </option>
              ))}
            </select>
          </div>

          {/* Split Type */}
          {!form.isSettlement && (
            <div>
              <label className="label-text">Split Type</label>
              <div className="grid grid-cols-4 gap-2">
                {SPLIT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, splitType: type })}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                      ${
                        form.splitType === type
                          ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                          : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic split fields */}
          {!form.isSettlement && form.splitType !== 'EQUAL' && splitDetails.length > 0 && (
            <div className="space-y-2">
              <label className="label-text">
                {form.splitType === 'EXACT' && 'Amount per person'}
                {form.splitType === 'PERCENTAGE' && 'Percentage per person'}
                {form.splitType === 'SHARES' && 'Shares per person'}
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {splitDetails.map((s, idx) => (
                  <div key={s.userId} className="flex items-center gap-3">
                    <span className="text-sm text-gray-300 w-24 truncate">{s.name}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        form.splitType === 'EXACT'
                          ? s.amount
                          : form.splitType === 'PERCENTAGE'
                          ? s.percentage
                          : s.shares
                      }
                      onChange={(e) =>
                        updateSplit(
                          idx,
                          form.splitType === 'EXACT'
                            ? 'amount'
                            : form.splitType === 'PERCENTAGE'
                            ? 'percentage'
                            : 'shares',
                          e.target.value
                        )
                      }
                      placeholder="0"
                      className="input-field flex-1"
                    />
                    <span className="text-xs text-gray-500 w-8">
                      {form.splitType === 'PERCENTAGE' ? '%' : form.splitType === 'SHARES' ? '×' : '₹'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label-text">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional notes..."
              className="input-field"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {form.isSettlement ? 'Record' : 'Add'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
