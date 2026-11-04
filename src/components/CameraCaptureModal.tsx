import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, FlipHorizontal, AlertTriangle, Check, Image as ImageIcon } from 'lucide-react';
import { Language } from '../types';
import { compressImage } from '../utils/image';

interface Props {
  language: Language;
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
}

export const CameraCaptureModal: React.FC<Props> = ({
  language,
  onCapture,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoading, setIsLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stop current active media stream safely
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }
  };

  // Start live camera stream
  const startCamera = async (mode: 'environment' | 'user') => {
    setIsLoading(true);
    setCameraError(null);
    stopStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsLoading(false);
      setCameraError(
        language === 'bn'
          ? 'এই ডিভাইসে সরাসরি ব্রাউজার ক্যামেরা সাপোর্ট পাওয়া যায়নি। নিচের বাটন দিয়ে তুলুন।'
          : 'Direct camera is not supported on this browser. Use system camera below.'
      );
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => console.warn('Video play error:', err));
          setIsLoading(false);
        };
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      // Try fallback with loose constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch((e) => console.warn('Fallback play error:', e));
            setIsLoading(false);
          };
        } else {
          setIsLoading(false);
        }
      } catch (fallbackErr) {
        setIsLoading(false);
        setCameraError(
          language === 'bn'
            ? 'ক্যামেরা খোলার অনুমতি মেলেনি। নিচের "ডিভাইস ক্যামেরা দিয়ে তুলুন" বাটন ব্যবহার করুন।'
            : 'Camera permission denied or camera in use. Use system camera button below.'
        );
      }
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopStream();
    };
  }, [facingMode]);

  // Flip front / rear camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture frame from video feed & immediately apply
  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    try {
      setIsProcessing(true);
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      // Crop to square for clean retail product thumbnail
      const size = Math.min(vWidth, vHeight);
      const startX = (vWidth - size) / 2;
      const startY = (vHeight - size) / 2;

      canvas.width = 360;
      canvas.height = 360;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // If front camera, mirror image for natural selfie orientation
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, startX, startY, size, size, 0, 0, 360, 360);
      }

      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      stopStream();
      onCapture(rawDataUrl);
      onClose();
    } catch (err) {
      console.error('Capture error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Native camera fallback (triggers device camera app directly)
  const handleNativeCameraFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsProcessing(true);
        const compressed = await compressImage(file, 360, 360, 0.8);
        if (compressed) {
          stopStream();
          onCapture(compressed);
          onClose();
        }
      } catch (err) {
        console.error('Native photo compression error:', err);
      } finally {
        setIsProcessing(false);
        if (e.target) e.target.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                {language === 'bn' ? 'পণ্যের ছবি তুলুন' : 'Take Product Photo'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'bn' ? 'ক্যামেরার সামনে পণ্যটি রাখুন' : 'Point camera at the product'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Video feed */}
        <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            /* Error State with direct native trigger */
            <div className="p-6 text-center space-y-4 max-w-xs">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {cameraError}
              </p>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>{language === 'bn' ? 'ডিভাইস ক্যামেরা দিয়ে তুলুন' : 'Open Device Camera'}</span>
              </button>
            </div>
          ) : (
            /* Active Live Video Stream */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder Target Frame Overlay */}
              <div className="absolute inset-8 pointer-events-none border-2 border-emerald-400/70 rounded-2xl">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              </div>

              {isLoading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs text-slate-300 font-medium">
                    {language === 'bn' ? 'ক্যামেরা চালু হচ্ছে...' : 'Starting camera...'}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Hidden native camera input as 100% reliable system fallback */}
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleNativeCameraFallback}
          />
        </div>

        {/* Footer Controls */}
        <div className="shrink-0 p-4 bg-slate-800/90 border-t border-slate-700/80">
          <div className="flex items-center justify-between px-2">
            {/* Native Camera App Option */}
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="flex flex-col items-center gap-1 text-slate-300 hover:text-white p-2 rounded-xl hover:bg-slate-700/50 active:scale-95 transition"
              title="ডিভাইস ক্যামেরা অ্যাপ দিয়ে ছবি তুলুন"
            >
              <div className="p-2.5 rounded-full bg-slate-700/70 border border-slate-600">
                <ImageIcon className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-semibold">
                {language === 'bn' ? 'সিস্টেম ক্যামেরা' : 'Device App'}
              </span>
            </button>

            {/* Big Main Shutter Button */}
            <button
              type="button"
              disabled={isLoading || !!cameraError || isProcessing}
              onClick={handleCapturePhoto}
              className="relative group p-1.5 rounded-full bg-white/20 active:scale-95 transition disabled:opacity-40"
              title="ছবি ক্যাপচার করে সাথে সাথে পণ্যে যুক্ত করুন"
            >
              <div className="w-16 h-16 rounded-full bg-white border-4 border-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950/60 transition group-hover:scale-105">
                <div className="w-12 h-12 rounded-full bg-emerald-600 group-active:scale-90 transition flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
            </button>

            {/* Flip Camera (Front / Rear) */}
            <button
              type="button"
              disabled={isLoading || !!cameraError}
              onClick={handleToggleFacingMode}
              className="flex flex-col items-center gap-1 text-slate-300 hover:text-white p-2 rounded-xl hover:bg-slate-700/50 active:scale-95 transition disabled:opacity-40"
              title="ক্যামেরা পরিবর্তন করুন"
            >
              <div className="p-2.5 rounded-full bg-slate-700/70 border border-slate-600">
                <FlipHorizontal className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-semibold">
                {language === 'bn' ? 'ঘোরান' : 'Flip'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
