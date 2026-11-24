import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File as FileGeneric,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatFileSize } from '@/utils/format';

export interface UploadedFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  progress?: number;
  error?: string;
}

export interface FileUploadProps {
  files?: UploadedFileItem[];
  onFilesChange?: (files: UploadedFileItem[]) => void;
  accept?: string;
  allowedExtensions?: string[]; // e.g. ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls']
  maxSizeMB?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  error?: string;
  className?: string;
}

const DEFAULT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls'];

export const FileUpload: React.FC<FileUploadProps> = ({
  files: controlledFiles,
  onFilesChange,
  accept = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls',
  allowedExtensions = DEFAULT_EXTENSIONS,
  maxSizeMB = 10,
  maxFiles = 5,
  multiple = true,
  disabled = false,
  label,
  helperText,
  error: externalError,
  className,
}) => {
  const [internalFiles, setInternalFiles] = useState<UploadedFileItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const files = controlledFiles !== undefined ? controlledFiles : internalFiles;

  const updateFiles = useCallback(
    (newFiles: UploadedFileItem[]) => {
      if (controlledFiles === undefined) {
        setInternalFiles(newFiles);
      }
      if (onFilesChange) {
        onFilesChange(newFiles);
      }
    },
    [controlledFiles, onFilesChange]
  );

  const validateAndAddFiles = useCallback(
    (incomingFiles: FileList | File[]) => {
      setUploadError(null);
      const fileArray = Array.from(incomingFiles);

      if (files.length + fileArray.length > maxFiles) {
        setUploadError(`Maximum ${maxFiles} files allowed.`);
        return;
      }

      const validItems: UploadedFileItem[] = [];

      for (const file of fileArray) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
          setUploadError(`File "${file.name}" has an unsupported format (${allowedExtensions.join(', ')}).`);
          return;
        }

        const sizeInMB = file.size / (1024 * 1024);
        if (sizeInMB > maxSizeMB) {
          setUploadError(`File "${file.name}" exceeds the maximum size limit of ${maxSizeMB} MB.`);
          return;
        }

        let previewUrl: string | undefined = undefined;
        if (file.type.startsWith('image/')) {
          previewUrl = URL.createObjectURL(file);
        }

        validItems.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl,
          progress: 100,
        });
      }

      updateFiles([...files, ...validItems]);
    },
    [files, maxFiles, allowedExtensions, maxSizeMB, updateFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      // Reset input value to allow re-uploading identical filename
      e.target.value = '';
    }
  };

  const removeFile = (id: string) => {
    const fileToRemove = files.find((f) => f.id === id);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    const updated = files.filter((f) => f.id !== id);
    updateFiles(updated);
  };

  const getFileIcon = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || '')) {
      return <ImageIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    }
    return <FileGeneric className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className={cn('w-full flex flex-col space-y-3', className)}>
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer select-none',
          'border-slate-300 dark:border-dark-border bg-slate-50/50 dark:bg-dark-card/60 hover:bg-slate-50 dark:hover:bg-dark-card hover:border-navy-600 dark:hover:border-navy-500',
          isDragOver && 'border-navy-700 dark:border-cyan-400 bg-navy-50/50 dark:bg-navy-950/30 scale-[1.01]',
          disabled && 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-full bg-navy-50 dark:bg-navy-900/60 border border-navy-100 dark:border-navy-800 flex items-center justify-center text-navy-700 dark:text-cyan-400 mb-3 shadow-inner">
          <UploadCloud className="w-6 h-6" />
        </div>

        <p className="text-sm font-semibold text-slate-800 dark:text-white">
          <span className="text-navy-700 dark:text-cyan-400 underline">Click to upload</span> or drag and drop
        </p>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          PDF, JPG, PNG, XLSX (up to {maxSizeMB}MB each, max {maxFiles} files)
        </p>
      </div>

      {/* Error Display */}
      {(uploadError || externalError) && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError || externalError}</span>
        </div>
      )}

      {/* Uploaded File List */}
      {files.length > 0 && (
        <div className="space-y-2 mt-2">
          {files.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-sm"
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-10 h-10 object-cover rounded-md border border-slate-200 dark:border-dark-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {getFileIcon(item.file)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {item.file.name}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{formatFileSize(item.file.size)}</span>
                    <span>&bull;</span>
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                  </div>
                </div>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(item.id);
                  }}
                  className="p-1.5 ml-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors focus:outline-none"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {helperText && !uploadError && !externalError && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}
    </div>
  );
};

export default FileUpload;
