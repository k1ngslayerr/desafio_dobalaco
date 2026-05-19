"use client";

import Image from "next/image";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";

interface PhotoLightboxProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

export function PhotoLightbox({ src, alt, open, onClose }: PhotoLightboxProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}
    >
      <DialogPrimitive.Portal>
        {/* Dark backdrop — click anywhere to close */}
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md
            data-open:animate-in data-open:fade-in-0
            data-closed:animate-out data-closed:fade-out-0
            duration-200"
        />

        {/* Popup — full viewport, image centered with contain */}
        <DialogPrimitive.Popup
          aria-label={alt}
          className="fixed inset-0 z-50 flex items-center justify-center outline-none
            data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
            data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
            duration-200"
          onClick={onClose}
        >
          {/* Image wrapper — stops click propagation so clicking the image itself doesn't close */}
          <div
            className="relative w-[92vw] h-[92vh] max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={src}
              alt={alt}
              fill
              className="object-contain select-none"
              sizes="92vw"
              unoptimized
              priority
            />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-4 right-4 rounded-full bg-black/60 p-2
              text-white hover:bg-black/80 active:scale-95
              transition-all duration-150 backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default PhotoLightbox;
