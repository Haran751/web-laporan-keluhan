'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ComplaintPhoto } from '@/types';

interface PhotoLightboxProps {
  photos: ComplaintPhoto[] | string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function PhotoLightbox({
  photos,
  initialIndex = 0,
  isOpen,
  onClose,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || photos.length === 0) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrentIndex((prev) => (prev + 1) % photos.length);
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, photos.length]);

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  const photoUrl = typeof currentPhoto === 'string' ? currentPhoto : currentPhoto.url;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Tombol Tutup */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/70 rounded-full transition"
        title="Tutup (Esc)"
      >
        <X size={26} />
      </button>

      {/* Info Nomor Foto */}
      <div className="absolute top-4 left-4 z-50 px-3.5 py-1.5 rounded-full bg-black/50 text-white font-mono text-sm tracking-wide border border-white/10">
        Foto {currentIndex + 1} dari {photos.length}
      </div>

      {/* Konten Gambar Utama */}
      <div
        className="relative max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
          <img
            src={photoUrl}
            alt={`Foto bukti kerusakan ${currentIndex + 1}`}
            className="max-h-[82vh] max-w-full object-contain rounded shadow-2xl transition-transform duration-200"
          />
        </div>

        {/* Tombol Navigasi Prev/Next (Jika lebih dari 1 foto) */}
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-4 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition shadow-lg hover:scale-105"
              title="Foto Sebelumnya (Panah Kiri)"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-4 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition shadow-lg hover:scale-105"
              title="Foto Berikutnya (Panah Kanan)"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail Bar di Bagian Bawah */}
      {photos.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/60 rounded-xl max-w-[90vw] overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((p, idx) => {
            const url = typeof p === 'string' ? p : p.url;
            return (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 transition-all ${
                  idx === currentIndex
                    ? 'ring-2 ring-kemenkes-400 scale-105 opacity-100'
                    : 'opacity-50 hover:opacity-80'
                }`}
              >
                <img
                  src={url}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
