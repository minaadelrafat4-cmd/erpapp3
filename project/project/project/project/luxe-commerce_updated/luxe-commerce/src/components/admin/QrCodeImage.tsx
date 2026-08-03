import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeImageProps {
  value: string | null | undefined;
  size?: number;
  className?: string;
}

/**
 * Renders a scannable QR code for a product's `qr_code` value.
 * Renders nothing (with a fallback message) if no value is available yet —
 * e.g. a brand-new product that hasn't been saved and assigned one.
 */
export function QrCodeImage({ value, size = 120, className }: QrCodeImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#1a1712', light: '#f5f1e8' },
    })
      .then(() => setFailed(false))
      .catch(() => setFailed(true));
  }, [value, size]);

  if (!value) {
    return <p className={className ?? 'text-xs text-ink-500'}>QR code will appear here once generated.</p>;
  }
  if (failed) {
    return <p className={className ?? 'text-xs text-error-500'}>Unable to render QR code for this value.</p>;
  }
  return <canvas ref={canvasRef} role="img" aria-label={`QR code ${value}`} className={className} />;
}
