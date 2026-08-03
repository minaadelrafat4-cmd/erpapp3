import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeImageProps {
  value: string | null | undefined;
  height?: number;
  width?: number;
  fontSize?: number;
  className?: string;
}

/**
 * Renders a scannable Code128 barcode for a product's `barcode` value.
 * Renders nothing (with a fallback message) if no value is available yet —
 * e.g. a brand-new product that hasn't been saved and assigned one.
 */
export function BarcodeImage({ value, height = 60, width = 2, fontSize = 14, className }: BarcodeImageProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!value || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        height,
        width,
        fontSize,
        margin: 8,
        background: 'transparent',
        lineColor: '#f5f1e8',
        displayValue: true,
      });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [value, height, width, fontSize]);

  if (!value) {
    return <p className={className ?? 'text-xs text-ink-500'}>Barcode will appear here once generated.</p>;
  }
  if (failed) {
    return <p className={className ?? 'text-xs text-error-500'}>Unable to render barcode for this value.</p>;
  }
  return <svg ref={svgRef} role="img" aria-label={`Barcode ${value}`} className={className} />;
}
