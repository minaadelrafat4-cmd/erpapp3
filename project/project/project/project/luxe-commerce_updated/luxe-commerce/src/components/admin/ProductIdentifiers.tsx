import { useState } from 'react';
import { Copy, RefreshCw, Check } from 'lucide-react';
import { BarcodeImage } from './BarcodeImage';
import { QrCodeImage } from './QrCodeImage';
import { Button } from '@/components/ui/Button';

interface ProductIdentifiersProps {
  sku: string | null | undefined;
  barcode: string | null | undefined;
  qrCode: string | null | undefined;
  /** Only shown once a product exists (editing an existing row). */
  isNew: boolean;
  /** Regenerates barcode + QR code server-side (identifiers.manage only). */
  onRegenerate?: () => Promise<void> | void;
  regenerating?: boolean;
  canManage?: boolean;
}

function CopyableValue({ label, value }: { label: string; value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked (permissions, insecure context) — fail silently.
    }
  };
  return (
    <div className="flex items-center justify-between glass rounded-xl px-3 py-2.5">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-500">{label}</p>
        <p className="text-sm font-mono text-ink-100">{value}</p>
      </div>
      <button type="button" onClick={copy} className="text-ink-400 hover:text-gold-300 transition" aria-label={`Copy ${label}`}>
        {copied ? <Check className="w-4 h-4 text-success-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function ProductIdentifiers({ sku, barcode, qrCode, isNew, onRegenerate, regenerating, canManage = true }: ProductIdentifiersProps) {
  if (isNew) {
    return (
      <div className="glass rounded-xl px-4 py-3">
        <p className="text-sm text-ink-300">
          A unique SKU, barcode, and QR code will be generated automatically once this product is saved.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <CopyableValue label="SKU" value={sku} />
        <CopyableValue label="Barcode" value={barcode} />
        <CopyableValue label="QR Code" value={qrCode} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-ink-400 self-start">Barcode</p>
          <BarcodeImage value={barcode} />
        </div>
        <div className="glass rounded-xl p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-ink-400 self-start">QR Code</p>
          <QrCodeImage value={qrCode} />
        </div>
      </div>

      {canManage && onRegenerate && (
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}>
          <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          {regenerating ? 'Regenerating…' : 'Regenerate barcode & QR code'}
        </Button>
      )}
    </div>
  );
}
