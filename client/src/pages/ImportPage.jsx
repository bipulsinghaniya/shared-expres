import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { uploadCSV, confirmImport } from '../api/imports';
import CSVUploader from '../components/import/CSVUploader';
import AnomalyReviewTable from '../components/import/AnomalyReviewTable';
import ImportReport from '../components/import/ImportReport';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';

export default function ImportPage() {
  const { groupId } = useParams();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importData, setImportData] = useState(null); // { importLogId, anomalies, summary, parsedRows }
  const [decisions, setDecisions] = useState({}); // { anomalyId: 'approved'|'rejected' }
  const [confirming, setConfirming] = useState(false);
  const [importResult, setImportResult] = useState(null); // Final result after confirm
  const [step, setStep] = useState('upload'); // 'upload' | 'review' | 'done'

  const handleUpload = async () => {
    if (!file) {
      toast.error('Select a CSV file first');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadCSV(groupId, file);
      // Restructure the response to match expected format
      const { importLog, summary } = res.data;
      setImportData({
        importLogId: importLog.id,
        anomalies: importLog.anomalies || [],
        summary,
        parsedRows: importLog.parsedRows || [],
      });
      setDecisions({});
      setStep('review');
      toast.success(`Parsed ${summary.totalRows} rows — review anomalies below`);
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
      const decisionList = Object.entries(decisions).map(([anomalyId, status]) => ({
        anomalyId,
        status,
      }));
      const res = await confirmImport(groupId, importData.importLogId, decisionList);
      setImportResult(res.data.summary);
      setStep('done');
      toast.success(`Import complete! ${res.data.summary.imported} expenses imported.`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to confirm import';
      toast.error(msg);

      // If there are unresolved anomalies, stay on review
      if (err.response?.data?.unresolvedCount) {
        toast.error(`${err.response.data.unresolvedCount} anomalies still pending`);
      }
    } finally {
      setConfirming(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setImportData(null);
    setDecisions({});
    setImportResult(null);
    setStep('upload');
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/groups/${groupId}`}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Import CSV</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Upload a CSV file, review anomalies, then confirm the import
          </p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {['Upload', 'Review', 'Done'].map((label, idx) => {
          const stepIdx = ['upload', 'review', 'done'].indexOf(step);
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
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                      : 'bg-gray-800 text-gray-600 border border-gray-700'
                  }`}
              >
                {idx + 1}
              </div>
              <span
                className={`text-sm font-medium hidden sm:block ${
                  isActive ? 'text-brand-300' : isDone ? 'text-emerald-400' : 'text-gray-600'
                }`}
              >
                {label}
              </span>
              {idx < 2 && (
                <div className={`flex-1 h-px ${isDone ? 'bg-emerald-500/30' : 'bg-gray-800'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <CSVUploader
            onFileSelect={setFile}
            selectedFile={file}
            disabled={uploading}
          />
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing CSV...
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

      {/* Step 2: Review anomalies */}
      {step === 'review' && importData && (
        <div className="space-y-4">
          {/* Quick summary */}
          <div className="glass-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-white">{importData.summary.totalRows}</p>
              <p className="text-xs text-gray-500">Total Rows</p>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-400">{importData.summary.successCount}</p>
              <p className="text-xs text-gray-500">Valid</p>
            </div>
            <div>
              <p className="text-xl font-bold text-rose-400">{importData.summary.errorCount}</p>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-400">{importData.summary.anomalyCount}</p>
              <p className="text-xs text-gray-500">Anomalies</p>
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
      {step === 'done' && (
        <div className="space-y-4">
          <ImportReport summary={importResult} />
          <div className="flex justify-center gap-3">
            <button onClick={resetImport} className="btn-secondary">
              Import Another CSV
            </button>
            <Link to={`/groups/${groupId}`} className="btn-primary">
              Back to Group
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
