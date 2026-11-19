import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { Camera, QrCode, Sparkles, Upload, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const QrScannerModal: React.FC = () => {
  const { isQrScannerOpen, setIsQrScannerOpen, products, showToast } = useStore();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualInput, setManualInput] = useState('');

  const resolveScannedPayload = useCallback(
    (rawValue: string) => {
      const cleaned = rawValue.trim();
      if (!cleaned) return;

      // Check URL with /product/:slug
      const slugMatch = cleaned.match(/\/product\/([a-zA-Z0-9\-_]+)/);
      if (slugMatch?.[1]) {
        const matched = products.find((p) => p.slug === slugMatch[1] || p.id === slugMatch[1]);
        if (matched) {
          setIsQrScannerOpen(false);
          navigate(`/product/${matched.slug}`);
          showToast(`Opened ${matched.name}`);
          return;
        }
      }

      // Check SKU or ID or exact slug
      const direct = products.find(
        (p) =>
          p.sku.toLowerCase() === cleaned.toLowerCase() ||
          p.slug.toLowerCase() === cleaned.toLowerCase() ||
          p.id.toLowerCase() === cleaned.toLowerCase()
      );
      if (direct) {
        setIsQrScannerOpen(false);
        navigate(`/product/${direct.slug}`);
        showToast(`Opened ${direct.name}`);
        return;
      }

      showToast(`Tag decoded: ${cleaned}`);
    },
    [navigate, products, setIsQrScannerOpen, showToast]
  );

  // Stop camera stream on close or unmount
  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!isQrScannerOpen) {
      stopCamera();
      setCameraError('');
    }
  }, [isQrScannerOpen, stopCamera]);

  // Camera scanning loop
  useEffect(() => {
    if (!cameraActive || !isQrScannerOpen) return;
    let rafId = 0;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            stopCamera();
            resolveScannedPayload(code.data);
            return;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [cameraActive, isQrScannerOpen, resolveScannedPayload, stopCamera]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setCameraError(
        'Camera permission unavailable in this browser. Upload a QR tag image or enter a SKU below.'
      );
      setCameraActive(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          resolveScannedPayload(code.data);
        } else {
          showToast('No valid QR code found in that image.');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  if (!isQrScannerOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0A0A0A]/65 p-4 backdrop-enter"
      role="dialog"
      aria-modal="true"
      aria-label="QR Code Tag Scanner"
    >
      <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-[#F3F2EE] border border-[#D9D9D9] navy-shadow-lg overflow-hidden modal-enter">
        <div className="bg-[#0A0A0A] text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-[#292929]">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-[#292929] border border-white/15 flex items-center justify-center text-white">
              <QrCode className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#D9D9D9]">
                PYTHOX TAG SCANNER
              </p>
              <h3 className="font-editorial text-lg font-bold text-white leading-tight">
                Scan Product Hangtag QR
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(false)}
            aria-label="Close QR scanner"
            className="btn-base btn-dark-ghost btn-icon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Camera preview or action frame */}
          <div className="relative aspect-[16/10] rounded-2xl bg-[#EAE9E4] border-2 border-dashed border-[#C8C7C2] overflow-hidden flex flex-col items-center justify-center text-center p-4">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 h-full w-full object-cover ${
                cameraActive ? 'block' : 'hidden'
              }`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {cameraActive ? (
              <div className="relative z-10 flex flex-col items-center justify-between h-full w-full py-2">
                <div className="h-36 w-36 rounded-2xl border-2 border-white shadow-[0_0_0_9999px_rgba(10,10,10,0.55)]" />
                <button
                  type="button"
                  onClick={stopCamera}
                  className="btn-base btn-primary btn-sm"
                >
                  Stop Camera
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-[#0A0A0A] text-white flex items-center justify-center">
                  <Camera className="h-5 w-5" />
                </div>
                <p className="text-xs text-[#292929] max-w-xs mx-auto">
                  Point your camera at a PYTHOX WORLD garment hangtag QR code or upload a QR card photo to open the item instantly.
                </p>
                {cameraError && (
                  <p className="text-[11px] text-[#0A0A0A] bg-white border border-[#292929] rounded-lg px-3 py-1.5 font-medium max-w-xs mx-auto">
                    {cameraError}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void startCamera()}
              className="btn-base btn-primary w-full"
            >
              <Camera className="h-4 w-4" />
              <span>Use Camera</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-base btn-secondary w-full"
            >
              <Upload className="h-4 w-4" />
              <span>Upload QR Image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Manual SKU / Tag lookup */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resolveScannedPayload(manualInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or enter product SKU"
              className="flex-1 min-w-0 min-h-[42px] rounded-[10px] border border-[#D4D3CE] bg-white px-3.5 py-2 text-xs font-mono text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
            />
            <button
              type="submit"
              className="btn-base btn-primary shrink-0"
            >
              Lookup
            </button>
          </form>

          {/* Quick Jump SKUs */}
          {products.length > 0 && (
            <div className="pt-2 border-t border-[#D9D9D9]">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C5C5C] mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#292929]" /> Quick Tag Jump
              </p>
              <div className="flex flex-wrap gap-2">
                {products.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => resolveScannedPayload(p.sku)}
                    className="chip-btn font-mono text-[11px]"
                  >
                    {p.sku}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
