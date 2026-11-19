import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  Maximize2,
  MessageCircle,
  QrCode,
  Share2,
  X,
} from 'lucide-react';
import { Product } from '../types/ecommerce';
import { BRAND_LOGO_URL } from '../config/storeConfig';
import { formatBDT } from '../lib/formatters';
import { useStore } from '../context/StoreContext';

interface ProductQrModalProps {
  open: boolean;
  initialTab?: 'share' | 'qr';
  product: Product;
  onClose: () => void;
}

export const ProductQrModal: React.FC<ProductQrModalProps> = ({
  open,
  initialTab = 'share',
  product,
  onClose,
}) => {
  const { showToast, settings } = useStore();
  const [tab, setTab] = useState<'share' | 'qr'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [fullscreenQr, setFullscreenQr] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const productUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/product/${product.slug}`
      : `https://pythoxworld.com/product/${product.slug}`;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, open]);

  // Draw scannable QR code onto canvas with centered PYTHOX emblem
  useEffect(() => {
    if (!open || tab !== 'qr') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(
      canvas,
      productUrl,
      {
        width: 240,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0A0A0A',
          light: '#FFFFFF',
        },
      },
      (err) => {
        if (err) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Center branded crest ring
        const center = canvas.width / 2;
        const badgeSize = 46;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(center, center, badgeSize / 2 + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#D9D9D9';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(center, center, badgeSize / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#0A0A0A';
        ctx.beginPath();
        ctx.arc(center, center, badgeSize / 2 - 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PW', center, center + 0.5);
      }
    );
  }, [open, tab, productUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      showToast('Product link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copy failed');
    }
  };

  const handleDownloadCard = async () => {
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = 640;
    cardCanvas.height = 820;
    const ctx = cardCanvas.getContext('2d');
    if (!ctx) return;

    // Soft White Card Background
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(0, 0, 640, 820);

    // Outer Primary Black Border + Light Grey Trim
    ctx.strokeStyle = '#0A0A0A';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, 622, 802);
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, 588, 768);

    // Header
    ctx.fillStyle = '#0A0A0A';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('PYTHOX WORLD', 320, 88);

    ctx.fillStyle = '#808080';
    ctx.font = '600 13px monospace';
    ctx.fillText(`MENSWEAR ARCHIVE · ${product.sku}`, 320, 116);

    // QR Code Center Box
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, productUrl, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#0A0A0A', light: '#FFFFFF' },
    });

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(140, 160, 360, 360);
    ctx.drawImage(qrCanvas, 140, 160);

    // Center monogram on downloaded QR
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(320, 340, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0A0A0A';
    ctx.beginPath();
    ctx.arc(320, 340, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D9D9D9';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('PW', 320, 346);

    // Product Metadata
    ctx.fillStyle = '#0A0A0A';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText(product.name.slice(0, 34), 320, 590);

    ctx.fillStyle = '#292929';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(formatBDT(product.price), 320, 635);

    ctx.fillStyle = '#808080';
    ctx.font = '500 14px sans-serif';
    ctx.fillText(settings.businessAddress, 320, 710);
    ctx.fillText('Scan to view sizes, fabric details & express order', 320, 740);

    const link = document.createElement('a');
    link.download = `${product.sku || product.slug}-pythox-qr.png`;
    link.href = cardCanvas.toDataURL('image/png');
    link.click();
    showToast('Branded QR Card downloaded');
  };

  if (!open) return null;

  const waShare = `https://wa.me/?text=${encodeURIComponent(
    `${product.name} (${formatBDT(product.price)}) at PYTHOX WORLD: ${productUrl}`
  )}`;
  const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    productUrl
  )}`;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0A0A0A]/65 p-4 backdrop-enter"
      role="dialog"
      aria-modal="true"
      aria-label="Share and Product QR"
    >
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-[#F3F2EE] border border-[#D9D9D9] navy-shadow-lg overflow-hidden modal-enter">
        {/* Header */}
        <div className="bg-[#0A0A0A] px-5 sm:px-6 py-4 flex items-center justify-between text-white border-b border-[#292929]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={BRAND_LOGO_URL}
              alt="PYTHOX WORLD"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-cover bg-white p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#D9D9D9]">
                {product.sku}
              </p>
              <h3 className="font-editorial text-base font-bold text-white line-clamp-1">
                {product.name}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share modal"
            className="btn-base btn-dark-ghost btn-icon shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2-Tab Switcher */}
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white border border-[#D4D3CE]">
            <button
              type="button"
              onClick={() => setTab('share')}
              className={`min-h-[38px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'share'
                  ? 'bg-[#0A0A0A] text-white'
                  : 'text-[#292929] hover:bg-[#F3F2EE]'
              }`}
            >
              <Share2 className="h-3.5 w-3.5" /> Quick Share
            </button>
            <button
              type="button"
              onClick={() => setTab('qr')}
              className={`min-h-[38px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'qr'
                  ? 'bg-[#0A0A0A] text-white'
                  : 'text-[#292929] hover:bg-[#F3F2EE]'
              }`}
            >
              <QrCode className="h-3.5 w-3.5" /> Product QR Code
            </button>
          </div>

          {tab === 'share' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-white border border-[#D9D9D9]">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-16 w-16 rounded-lg object-cover shrink-0 bg-[#EAE9E4]"
                />
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#5C5C5C]">
                    {product.category}
                  </p>
                  <p className="font-editorial text-sm font-bold text-[#0A0A0A] truncate">
                    {product.name}
                  </p>
                  <p className="font-mono text-xs font-semibold text-[#292929] tabular-nums">
                    {formatBDT(product.price)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={productUrl}
                  className="flex-1 min-w-0 min-h-[42px] rounded-[10px] border border-[#D4D3CE] bg-white px-3 py-2 text-xs font-mono text-[#0A0A0A]"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="btn-base btn-primary shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={waShare}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-base btn-primary w-full"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
                <a
                  href={fbShare}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-base btn-secondary w-full"
                >
                  <Share2 className="h-4 w-4" /> Facebook
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <button
                type="button"
                onClick={() => setFullscreenQr(true)}
                className="group relative p-4 rounded-2xl bg-white border border-[#D4D3CE] shadow-xs hover:border-[#0A0A0A] transition-colors cursor-pointer"
                title="Click to expand QR code"
              >
                <canvas ref={canvasRef} className="rounded-lg block" />
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-[#0A0A0A]">
                  <Maximize2 className="h-3 w-3 text-[#5C5C5C]" /> Tap to Expand
                </span>
              </button>

              <p className="text-xs text-center text-[#5C5C5C] max-w-xs">
                Scan with any smartphone camera or the PYTHOX header QR scanner to inspect this garment instantly.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={() => void handleDownloadCard()}
                  className="btn-base btn-primary w-full"
                >
                  <Download className="h-4 w-4" /> Save PNG Card
                </button>
                <a
                  href={waShare}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-base btn-secondary w-full"
                >
                  <MessageCircle className="h-4 w-4" /> Share WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen QR Lightbox */}
      {fullscreenQr && (
        <div
          className="fixed inset-0 z-[110] bg-[#0A0A0A]/95 flex flex-col items-center justify-center p-6 text-center"
          onClick={() => setFullscreenQr(false)}
        >
          <div
            className="bg-[#F3F2EE] p-7 sm:p-8 rounded-3xl border border-[#D9D9D9] space-y-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#5C5C5C]">
              PYTHOX WORLD · {product.sku}
            </p>
            <h4 className="font-editorial text-2xl font-bold text-[#0A0A0A]">
              {product.name}
            </h4>
            <div className="bg-white p-4 rounded-2xl inline-block border border-[#D9D9D9]">
              <img
                src={canvasRef.current?.toDataURL() || ''}
                alt={`QR Code for ${product.name}`}
                className="w-60 h-60 mx-auto"
              />
            </div>
            <p className="font-mono text-base font-bold text-[#0A0A0A]">
              {formatBDT(product.price)}
            </p>
            <button
              type="button"
              onClick={() => setFullscreenQr(false)}
              className="btn-base btn-primary w-full"
            >
              Close Fullscreen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
