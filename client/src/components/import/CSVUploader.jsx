import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X } from 'lucide-react';

export default function CSVUploader({ onFileSelect, selectedFile, disabled }) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled,
  });

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${
            isDragActive
              ? 'border-brand-400 bg-brand-500/10 scale-[1.02]'
              : selectedFile
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-gray-700 hover:border-brand-500/40 hover:bg-brand-500/5'
          }`}
      >
        <input {...getInputProps()} />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{selectedFile.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatSize(selectedFile.size)}</p>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileSelect(null);
                }}
                className="text-xs text-gray-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/20 flex items-center justify-center">
              <Upload className="w-7 h-7 text-brand-400" />
            </div>
            <div>
              <p className="text-sm text-gray-300">
                {isDragActive ? (
                  <span className="text-brand-300 font-medium">Drop your CSV here...</span>
                ) : (
                  <>
                    <span className="text-brand-400 font-medium">Click to browse</span> or drag
                    and drop
                  </>
                )}
              </p>
              <p className="text-xs text-gray-600 mt-1">CSV files only, up to 5MB</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
