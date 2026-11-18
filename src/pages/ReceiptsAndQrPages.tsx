import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Camera,
  CameraOff,
  Download,
  Eye,
  IndianRupee,
  Printer,
  QrCode,
  Search,
  Upload,
} from 'lucide-react';
import { useMaa } from '../context/MaaContext';
import {
  computeMemberFinancialSummary,
  formatDateIN,
  formatINR,
  formatMonthLabel,
} from '../lib/chandaEngine';
import { downloadReceiptPDF } from '../lib/exporters';
import { t } from '../lib/i18n';
import { Member, Receipt } from '../types/maa';
import { StatusLabel } from '../components/StatusLabel';
import { ReceiptModal } from '../components/ReceiptModal';

/* =========================================================
 * Page 11: Digital Receipts
 * ========================================================= */
export const DigitalReceiptsPage: React.FC = () => {
  const { language, receipts, settings, currentUser } = useMaa();
  const [search, setSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const scoped =
      currentUser?.role === 'MEMBER' && currentUser.memberId
        ? receipts.filter((r) => r.memberId === currentUser.memberId)
        : receipts;
    return [...scoped]
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
      .filter(
        (r) =>
          !q ||
          r.receiptNumber.toLowerCase().includes(q) ||
          r.memberName.toLowerCase().includes(q) ||
          r.memberCode.toLowerCase().includes(q)
      );
  }, [receipts, search, currentUser]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'nav_receipts')}
          </h2>
          <p className="text-xs text-slate-500">
            {filtered.length} {language === 'bn' ? 'টি ডিজিটাল রসিদ' : 'digital receipts'}
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Receipt # or Member..."
            className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Receipt #</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0F2143] dark:text-amber-300">
                    {r.receiptNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{formatDateIN(r.paymentDate)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.memberName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{r.memberCode}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{formatMonthLabel(r.monthKey, language)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                    {formatINR(r.amountPaise)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusLabel status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-md"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {t(language, 'view')}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadReceiptPDF(r, settings)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#0F2143] text-white rounded-md"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
    </div>
  );
};

/* =========================================================
 * Page 12: QR Scanner & Member QR Directory
 * ========================================================= */
export const QrScannerPage: React.FC = () => {
  const {
    language,
    members,
    ledgers,
    payments,
    setSelectedMemberId,
    setPrefillCollectMemberId,
    setActivePage,
  } = useMaa();

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [matchedMember, setMatchedMember] = useState<Member | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const resolveQrPayload = (raw: string) => {
    const cleaned = raw.trim().replace(/^MAA-MEM:/i, '');
    const found = members.find(
      (m) =>
        m.memberCode.toLowerCase() === cleaned.toLowerCase() ||
        m.id.toLowerCase() === cleaned.toLowerCase()
    );
    if (found) {
      setMatchedMember(found);
      setCameraError(null);
    } else {
      setCameraError(`No member found for QR reference "${raw}"`);
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);

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
              resolveQrPayload(code.data);
              stopCamera();
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          rafRef.current = requestAnimationFrame(tick);
        }
      }, 100);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Camera access unavailable: ${err.message}. Use QR image upload or manual Member ID lookup below.`
          : 'Camera unavailable'
      );
      setScanning(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        resolveQrPayload(code.data);
      } else {
        setCameraError('Could not detect a valid MAA QR code in the uploaded image.');
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const matchedSummary = matchedMember
    ? computeMemberFinancialSummary(matchedMember, ledgers, payments)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'nav_qr-scanner')}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'bn'
            ? 'সদস্যের QR কার্ড স্ক্যান করে দ্রুত বকেয়া দেখুন এবং চাঁদা সংগ্রহ করুন'
            : 'Scan non-sensitive Member QR codes (MAA-MEM:MAA-XXXX) to view status and collect chanda'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Controls */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap gap-2.5">
            {!scanning ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white hover:bg-[#162D59]"
              >
                <Camera className="w-4 h-4" />
                {language === 'bn' ? 'ক্যামেরা স্ক্যান চালু করুন' : 'Start Camera Scanner'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-red-700 text-white"
              >
                <CameraOff className="w-4 h-4" />
                Stop Camera
              </button>
            )}

            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50">
              <Upload className="w-4 h-4" />
              <span>Upload QR Image</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          {scanning && (
            <div className="relative rounded-lg overflow-hidden bg-slate-950 aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {cameraError && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {cameraError}
            </div>
          )}

          {/* Manual QR / Member ID Lookup */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualInput.trim()) resolveQrPayload(manualInput);
            }}
            className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter MAA-0001 or scan payload..."
              className="flex-1 px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#D95D16] text-white"
            >
              Find Member
            </button>
          </form>
        </div>

        {/* Matched Member Result */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          {matchedMember && matchedSummary ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <div className="font-mono text-xs text-[#D95D16] font-bold">
                    {matchedMember.memberCode}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {matchedMember.fullName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {matchedMember.mobile} · {matchedMember.area}
                  </p>
                </div>
                <StatusLabel status={matchedMember.status} />
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950">
                  <div className="text-xs text-slate-500">Monthly</div>
                  <div className="font-mono font-bold mt-1">
                    {formatINR(matchedMember.monthlyChandaPaise)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950">
                  <div className="text-xs text-slate-500">Outstanding</div>
                  <div className="font-mono font-bold text-amber-700 mt-1">
                    {formatINR(matchedSummary.totalOutstandingPaise)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950">
                  <div className="text-xs text-slate-500">Advance</div>
                  <div className="font-mono font-bold text-emerald-700 mt-1">
                    {formatINR(matchedSummary.advanceBalancePaise)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrefillCollectMemberId(matchedMember.id);
                    setActivePage('collect');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2143] text-white"
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  Collect Chanda
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMemberId(matchedMember.id);
                    setActivePage('member-details');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  View Full Profile
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-500 space-y-2">
              <QrCode className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-medium">Scan a member QR code to inspect status</p>
              <p className="text-xs">QR codes contain only non-sensitive Member ID references.</p>
            </div>
          )}
        </div>
      </div>

      {/* Printable Member QR Directory */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Member QR Code Cards</h3>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <Printer className="w-3.5 h-3.5" />
            Print QR Cards
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {members
            .filter((m) => m.status === 'ACTIVE')
            .slice(0, 12)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMatchedMember(m)}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center hover:border-[#0F2143] transition-colors"
              >
                <QRCodeCanvas value={`MAA-MEM:${m.memberCode}`} size={84} level="M" />
                <div className="font-mono text-xs font-bold mt-2">{m.memberCode}</div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-full">
                  {m.fullName}
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
