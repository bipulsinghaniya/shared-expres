import { CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';

export default function ImportReport({ summary }) {
  if (!summary) return null;

  return (
    <div className="glass-card p-6 animate-slide-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Import Complete</h3>
          <p className="text-xs text-gray-500">CSV has been processed and committed</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-800/40 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{summary.totalRows}</p>
          <p className="text-xs text-gray-500 mt-1">Total Rows</p>
        </div>
        <div className="bg-emerald-500/10 rounded-xl p-4 text-center border border-emerald-500/20">
          <p className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-5 h-5" /> {summary.imported}
          </p>
          <p className="text-xs text-emerald-400/70 mt-1">Imported</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-400 flex items-center justify-center gap-1">
            <XCircle className="w-5 h-5" /> {summary.skipped}
          </p>
          <p className="text-xs text-gray-500 mt-1">Skipped</p>
        </div>
        <div className="bg-amber-500/10 rounded-xl p-4 text-center border border-amber-500/20">
          <p className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-1">
            <AlertTriangle className="w-5 h-5" /> {summary.errors || 0}
          </p>
          <p className="text-xs text-amber-400/70 mt-1">Errors</p>
        </div>
      </div>
    </div>
  );
}
