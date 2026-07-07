import React from 'react';
import { Download, ExternalLink, FileImage, FileText, Paperclip, Trash2 } from 'lucide-react';
import { ProofAttachment } from '../types';
import { createEntityId, getLocalDateInputValue } from '../lib/hotelState';

interface ProofUploadFieldProps {
  label: string;
  category: string;
  value: ProofAttachment[];
  onChange: (value: ProofAttachment[]) => void;
  helperText?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });

const openAttachment = (attachment: ProofAttachment) => {
  window.open(attachment.dataUrl, '_blank', 'noopener,noreferrer');
};

const downloadAttachment = (attachment: ProofAttachment) => {
  const link = document.createElement('a');
  link.href = attachment.dataUrl;
  link.download = attachment.name || 'proof-file';
  link.click();
};

const isImageAttachment = (attachment: ProofAttachment): boolean =>
  String(attachment.mimeType || '').toLowerCase().startsWith('image/');

export default function ProofUploadField({
  label,
  category,
  value,
  onChange,
  helperText,
  accept = 'image/*,.pdf',
  multiple = true,
  disabled = false,
}: ProofUploadFieldProps) {
  const [uploading, setUploading] = React.useState(false);

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(event.currentTarget.files || []);
    if (files.length === 0) {
      return;
    }

    const oversizeFiles = files.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizeFiles.length > 0) {
      alert(`These files are too large to store inside the app: ${oversizeFiles.map((file) => file.name).join(', ')}. Keep each file under 2 MB.`);
    }

    const allowedFiles = files.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
    if (allowedFiles.length === 0) {
      event.currentTarget.value = '';
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('vha_auth_token') || '';
      const uploadedAt = getLocalDateInputValue();

      const attachments = await Promise.all(
        allowedFiles.map(async (file) => {
          const id = createEntityId('PF');
          const dataUrl = await readFileAsDataUrl(file);

          const res = await fetch('/api/proofs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              id,
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              dataUrl
            })
          });

          if (!res.ok) {
            throw new Error(`Failed to upload ${file.name} to the server.`);
          }

          return {
            id,
            category,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl: `/api/proofs/${id}?token=${encodeURIComponent(token)}`,
            uploadedAt,
          };
        })
      );

      onChange(multiple ? [...value, ...attachments] : attachments.slice(0, 1));
    } catch (err: any) {
      console.error("Proof file upload failed:", err);
      alert(err.message || "Failed to upload proof files to the server.");
    } finally {
      setUploading(false);
      event.currentTarget.value = '';
    }
  };

  const isControlDisabled = disabled || uploading;

  return (
    <div className="space-y-2">
      <label className="block text-sm text-slate-600">{label}</label>
      <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm transition ${isControlDisabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-white'}`}>
        <Paperclip className="h-4 w-4" />
        <span>{uploading ? 'Uploading proof...' : (multiple ? 'Upload files' : 'Upload file')}</span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={isControlDisabled}
          onChange={handleFileSelection}
          className="hidden"
        />
      </label>
      {helperText && <p className="text-[11px] text-slate-400">{helperText}</p>}

      {value.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          {value.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex min-w-0 items-center gap-2">
                {isImageAttachment(attachment) ? (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="h-10 w-10 rounded border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-white text-slate-500">
                    {String(attachment.mimeType || '').includes('pdf') ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <FileImage className="h-4 w-4" />
                    )}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{attachment.name}</p>
                  <p className="text-[10px] text-slate-400">{Math.round(attachment.size / 1024)} KB</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openAttachment(attachment)}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100"
                  title="View file"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => downloadAttachment(attachment)}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100"
                  title="Download file"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {!isControlDisabled && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((item) => item.id !== attachment.id))}
                    className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 transition hover:bg-rose-50"
                    title="Remove file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
