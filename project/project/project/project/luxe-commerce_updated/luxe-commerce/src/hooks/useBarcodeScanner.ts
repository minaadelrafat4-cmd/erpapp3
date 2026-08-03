import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  minBufferLength?: number;
  maxKeyIntervalMs?: number;
}

export function useBarcodeScanner({
  onScan,
  minBufferLength = 3,
  maxKeyIntervalMs = 50, // Scanners type character strings in rapid succession (<50ms apart)
}: UseBarcodeScannerProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses originating inside input fields or textareas
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minBufferLength) {
          onScan(bufferRef.current);
          bufferRef.current = '';
        }
        return;
      }

      // Single printable character check
      if (e.key.length === 1) {
        if (timeDiff > maxKeyIntervalMs && bufferRef.current.length > 0) {
          // Reset buffer if delay between keystrokes exceeds scanner threshold
          bufferRef.current = '';
        }

        bufferRef.current += e.key;
        lastKeyTimeRef.current = currentTime;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, minBufferLength, maxKeyIntervalMs]);
}