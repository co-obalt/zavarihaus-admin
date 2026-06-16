import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Phone,
  MessageCircle,
  Clock,
  Eye,
  Archive,
  Inbox,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  AlertCircle,
} from 'lucide-react';

interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
}

interface WebsiteInquiriesViewProps {
  sessionToken: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'New' },
  read: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', label: 'Read' },
  archived: { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-400', label: 'Archived' },
};

const formatDate = (iso: string) => {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function WebsiteInquiriesView({ sessionToken }: WebsiteInquiriesViewProps) {
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchInquiries = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const url = filterStatus === 'all'
        ? '/api/public/contact-inquiry'
        : `/api/public/contact-inquiry?status=${filterStatus}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error('Failed to load inquiries.');
      const data = await res.json();
      setInquiries(data.inquiries || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load inquiries.');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, filterStatus]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const updateStatus = async (id: string, newStatus: 'new' | 'read' | 'archived') => {
    if (!sessionToken) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/public/contact-inquiry/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Update failed.');
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, status: newStatus } : inq))
      );
    } catch {
      // Silently fail — user can retry
    } finally {
      setUpdatingId(null);
    }
  };

  const newCount = inquiries.filter((i) => i.status === 'new').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-amber-600" />
            Contact Inquiries
            {newCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white leading-none">
                {newCount} new
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Messages submitted through the public website contact form</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-600 font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="all">All Inquiries</option>
            <option value="new">New Only</option>
            <option value="read">Read</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={fetchInquiries}
            disabled={loading}
            className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && inquiries.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">Loading inquiries...</div>
      )}

      {/* Empty */}
      {!loading && inquiries.length === 0 && !error && (
        <div className="text-center py-16">
          <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-semibold">No inquiries found</p>
          <p className="text-xs text-slate-300 mt-1">Contact form submissions will appear here</p>
        </div>
      )}

      {/* Inquiry Cards */}
      {inquiries.length > 0 && (
        <div className="space-y-3">
          {inquiries.map((inquiry) => {
            const isExpanded = expandedId === inquiry.id;
            const style = STATUS_STYLES[inquiry.status] || STATUS_STYLES.new;
            const isUpdating = updatingId === inquiry.id;

            return (
              <div
                key={inquiry.id}
                className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all ${
                  inquiry.status === 'new' ? 'border-l-4 border-l-amber-400' : ''
                }`}
              >
                {/* Row header */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : inquiry.id);
                    if (inquiry.status === 'new' && !isExpanded) {
                      updateStatus(inquiry.id, 'read');
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    inquiry.status === 'new' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 truncate">{inquiry.name}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {inquiry.message.slice(0, 90)}{inquiry.message.length > 90 ? '...' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-slate-400 hidden sm:block">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {formatDate(inquiry.created_at)}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/30 space-y-4">
                    {/* Contact info */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                      {inquiry.email && (
                        <a href={`mailto:${inquiry.email}`} className="flex items-center gap-1.5 hover:text-amber-600 transition-colors">
                          <Mail className="w-3.5 h-3.5" />
                          {inquiry.email}
                        </a>
                      )}
                      {inquiry.phone && (
                        <a href={`tel:${inquiry.phone}`} className="flex items-center gap-1.5 hover:text-amber-600 transition-colors">
                          <Phone className="w-3.5 h-3.5" />
                          {inquiry.phone}
                        </a>
                      )}
                      <span className="text-slate-400 flex items-center gap-1.5 sm:hidden">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(inquiry.created_at)}
                      </span>
                    </div>

                    {/* Message body */}
                    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{inquiry.message}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {inquiry.status !== 'new' && (
                        <button
                          onClick={() => updateStatus(inquiry.id, 'new')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 rounded-xl px-3 py-1.5 hover:bg-amber-100 cursor-pointer disabled:opacity-50"
                        >
                          <Inbox className="w-3.5 h-3.5" />
                          Mark as New
                        </button>
                      )}
                      {inquiry.status !== 'read' && inquiry.status === 'new' && (
                        <button
                          onClick={() => updateStatus(inquiry.id, 'read')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 text-xs font-semibold border border-slate-200 bg-white text-slate-600 rounded-xl px-3 py-1.5 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Mark as Read
                        </button>
                      )}
                      {inquiry.status !== 'archived' && (
                        <button
                          onClick={() => updateStatus(inquiry.id, 'archived')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 text-xs font-semibold border border-slate-200 bg-white text-slate-400 rounded-xl px-3 py-1.5 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
