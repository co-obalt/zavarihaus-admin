import React from 'react';
import { Download, ExternalLink, FileImage, FileText } from 'lucide-react';
import { ProofAttachment } from '../types';

interface ProofAttachmentGalleryProps {
  attachments: ProofAttachment[];
  emptyMessage?: string;
}

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

export default function ProofAttachmentGallery({
  attachments,
  emptyMessage = 'No files attached.',
}: ProofAttachmentGalleryProps) {
  if (!attachments || attachments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
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
              <p className="truncate text-xs font-medium text-slate-800">{attachment.name}</p>
              <p className="text-[10px] text-slate-400">
                {Math.round(Number(attachment.size || 0) / 1024)} KB
              </p>
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
          </div>
        </div>
      ))}
    </div>
  );
}
