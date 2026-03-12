import { useState, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";
import type { ImageItem, OutputFormat } from "./types";
import { formatBytes } from "./utils/format-bytes";
import { ImageList } from "./components/ImageList";

const ACCEPTED_TYPES = "image/*,.pdf,application/pdf";

function isAcceptedFile(file: File) {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}

interface UploadAreaProps {
  isProcessing: boolean;
  onFiles: (files: FileList) => void;
}

interface FormatSelectorProps {
  format: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

function FormatSelector({ format, onChange }: FormatSelectorProps) {
  const options: { value: OutputFormat; label: string }[] = [
    { value: "jpeg", label: "JPG" },
    { value: "png", label: "PNG" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Output Format</label>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`flex-1 py-2 px-4 border rounded-lg bg-transparent text-inherit cursor-pointer text-sm transition-all
              ${format === opt.value ? "border-brand bg-brand/15 text-brand font-semibold" : "border-gray-600 hover:border-gray-400"}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ControlPanelProps {
  format: OutputFormat;
  quality: number;
  isMerging: boolean;
  isExporting: boolean;
  onFormatChange: (format: OutputFormat) => void;
  onQualityChange: (quality: number) => void;
  onMerge: () => void;
  onExportPdf: () => void;
}

function QualitySlider({
  quality,
  onChange,
}: {
  quality: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        Quality:{" "}
        <span className="text-brand font-semibold">
          {Math.round(quality * 100)}%
        </span>
      </label>
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.01"
        value={quality}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-brand"
      />
      <div className="flex justify-between text-[0.7rem] text-gray-500">
        <span>Smaller file</span>
        <span>Higher quality</span>
      </div>
    </div>
  );
}

const ACTION_BTN =
  "py-3 px-6 text-base font-semibold text-white border-none rounded-lg cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

function ControlPanel({
  format,
  quality,
  isMerging,
  isExporting,
  onFormatChange,
  onQualityChange,
  onMerge,
  onExportPdf,
}: ControlPanelProps) {
  return (
    <div className="mt-6 p-5 border border-border-dark dark:border-border-dark rounded-xl flex flex-col gap-5">
      <FormatSelector format={format} onChange={onFormatChange} />

      {format === "jpeg" && (
        <QualitySlider quality={quality} onChange={onQualityChange} />
      )}

      <button
        className={`${ACTION_BTN} bg-brand hover:bg-brand-hover`}
        onClick={onMerge}
        disabled={isMerging}
      >
        {isMerging ? "Merging..." : "Merge Images"}
      </button>
      <button
        className={`${ACTION_BTN} bg-danger hover:bg-danger-hover`}
        onClick={onExportPdf}
        disabled={isExporting}
      >
        {isExporting ? "Exporting..." : "Export as PDF"}
      </button>
    </div>
  );
}

interface MergeResultProps {
  url: string;
  size: number;
  format: OutputFormat;
  onDownload: () => void;
}

function MergeResult({ url, size, format, onDownload }: MergeResultProps) {
  return (
    <div className="mt-8 border border-border-dark dark:border-border-dark rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="m-0 text-xl font-semibold">Result</h2>
        <span className="text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full">
          {formatBytes(size)}
        </span>
      </div>
      <img
        src={url}
        alt="Merged result"
        className="w-full rounded-lg border border-[#2a2a2a]"
      />
      <button
        className="mt-4 w-full py-3 text-base font-semibold bg-success text-white border-none rounded-lg cursor-pointer transition-colors hover:bg-success-hover"
        onClick={onDownload}
      >
        Download {format === "jpeg" ? "JPG" : "PNG"}
      </button>
    </div>
  );
}

function UploadArea({ isProcessing, onFiles }: UploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    const files = e.dataTransfer.files;
    if (!files.length) return;
    const dt = new DataTransfer();
    Array.from(files).forEach((f) => {
      if (isAcceptedFile(f)) dt.items.add(f);
    });
    if (dt.files.length) onFiles(dt.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl py-10 px-4 text-center cursor-pointer select-none transition-colors
        ${isDragOver ? "border-brand bg-brand/5" : "border-gray-600 dark:border-gray-600 light:border-gray-300"}
        ${!isDragOver && !isProcessing ? "hover:border-brand hover:bg-brand/5" : ""}
        ${isProcessing ? "pointer-events-none opacity-70" : ""}`}
      onClick={() => !isProcessing && fileInputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {isProcessing ? (
        <>
          <div className="text-4xl leading-none mb-2 text-brand animate-spin-slow">
            &#8635;
          </div>
          <div>Processing PDF...</div>
        </>
      ) : (
        <>
          <div className="text-4xl leading-none mb-2 text-brand">+</div>
          <div>Click or drag files here to upload</div>
          <div className="text-xs text-gray-500 mt-1">
            Supports PNG, JPG, WebP, PDF, etc.
          </div>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        onChange={handleChange}
        hidden
      />
    </div>
  );
}

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

const loadImage = (file: File, label?: string): Promise<ImageItem> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        file,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        label: label ?? file.name,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
};

const pdfToImages = async (file: File): Promise<ImageItem[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const items: ImageItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png"),
    );
    const imgFile = new File([blob], `${file.name}-page${i}.png`, {
      type: "image/png",
    });
    const item = await loadImage(
      imgFile,
      `${file.name} (p.${i}/${pdf.numPages})`,
    );
    items.push(item);
  }

  return items;
};

const drawImageHighQuality = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  destY: number,
) => {
  if (targetWidth >= img.naturalWidth * 0.5) {
    ctx.drawImage(img, 0, destY, targetWidth, targetHeight);
    return;
  }

  const steps: HTMLCanvasElement[] = [];
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  const first = document.createElement("canvas");
  first.width = sw;
  first.height = sh;
  const fCtx = first.getContext("2d")!;
  fCtx.drawImage(img, 0, 0);
  steps.push(first);

  while (sw * 0.5 > targetWidth) {
    sw = Math.round(sw * 0.5);
    sh = Math.round(sh * 0.5);
    const step = document.createElement("canvas");
    step.width = sw;
    step.height = sh;
    const sCtx = step.getContext("2d")!;
    sCtx.drawImage(steps[steps.length - 1], 0, 0, sw, sh);
    steps.push(step);
  }

  ctx.drawImage(steps[steps.length - 1], 0, destY, targetWidth, targetHeight);
};

function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [quality, setQuality] = useState(0.85);
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergedSize, setMergedSize] = useState<number>(0);
  const [isMerging, setIsMerging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = async (files: FileList) => {
    setIsProcessing(true);
    try {
      const allItems: ImageItem[] = [];
      for (const file of Array.from(files)) {
        if (file.type === "application/pdf") {
          const pdfItems = await pdfToImages(file);
          allItems.push(...pdfItems);
        } else if (file.type.startsWith("image/")) {
          allItems.push(await loadImage(file));
        }
      }
      if (allItems.length > 0) {
        setImages((prev) => [...prev, ...allItems]);
        setMergedUrl(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((i) => i.id !== id);
    });
    setMergedUrl(null);
  };

  const reorderImages = (from: number, to: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setMergedUrl(null);
  };

  const mergeImages = useCallback(async () => {
    if (images.length === 0) return;
    setIsMerging(true);

    try {
      const loadedImgs = await Promise.all(
        images.map(
          (item) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = item.url;
            }),
        ),
      );

      const maxWidth = Math.max(...images.map((i) => i.width));
      const totalHeight = images.reduce((sum, img) => {
        const scale = maxWidth / img.width;
        return sum + img.height * scale;
      }, 0);

      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = Math.round(totalHeight);
      const ctx = canvas.getContext("2d")!;

      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      let y = 0;
      for (let i = 0; i < loadedImgs.length; i++) {
        const img = loadedImgs[i];
        const scale = maxWidth / images[i].width;
        const scaledHeight = Math.round(images[i].height * scale);

        drawImageHighQuality(ctx, img, maxWidth, scaledHeight, y);
        y += scaledHeight;
      }

      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b!),
          mimeType,
          format === "jpeg" ? quality : undefined,
        );
      });

      if (mergedUrl) URL.revokeObjectURL(mergedUrl);
      const url = URL.createObjectURL(blob);
      setMergedUrl(url);
      setMergedSize(blob.size);
    } finally {
      setIsMerging(false);
    }
  }, [images, quality, format, mergedUrl]);

  const downloadImage = () => {
    if (!mergedUrl) return;
    const a = document.createElement("a");
    a.href = mergedUrl;
    a.download = `merged-image.${format === "jpeg" ? "jpg" : "png"}`;
    a.click();
  };

  const exportAsPdf = useCallback(async () => {
    if (images.length === 0) return;
    setIsExporting(true);

    try {
      const loadedImgs = await Promise.all(
        images.map(
          (item) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = item.url;
            }),
        ),
      );

      const firstImg = images[0];
      const pdfWidth = firstImg.width;
      const pdfHeight = firstImg.height;
      const orientation = pdfWidth > pdfHeight ? "landscape" : "portrait";

      const pdf = new jsPDF({
        orientation,
        unit: "px",
        format: [pdfWidth, pdfHeight],
        hotfixes: ["px_scaling"],
      });

      for (let i = 0; i < loadedImgs.length; i++) {
        if (i > 0) {
          const w = images[i].width;
          const h = images[i].height;
          pdf.addPage([w, h], w > h ? "landscape" : "portrait");
        }

        const img = loadedImgs[i];
        const { width, height } = images[i];

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        pdf.addImage(dataUrl, "JPEG", 0, 0, width, height);
      }

      pdf.save("merged-images.pdf");
    } finally {
      setIsExporting(false);
    }
  }, [images, quality]);

  return (
    <div className="max-w-180 mx-auto py-8 px-4 font-sans">
      <h1 className="text-3xl font-bold mb-1">Image Merge Tool</h1>
      <p className="text-gray-400 mb-6">
        Upload images, reorder by drag &amp; drop, merge vertically and
        download.
      </p>

      <UploadArea isProcessing={isProcessing} onFiles={processFiles} />

      {images.length > 0 && (
        <ImageList
          images={images}
          onReorder={reorderImages}
          onRemove={removeImage}
        />
      )}

      {images.length > 0 && (
        <ControlPanel
          format={format}
          quality={quality}
          isMerging={isMerging}
          isExporting={isExporting}
          onFormatChange={(f) => {
            setFormat(f);
            setMergedUrl(null);
          }}
          onQualityChange={(q) => {
            setQuality(q);
            setMergedUrl(null);
          }}
          onMerge={mergeImages}
          onExportPdf={exportAsPdf}
        />
      )}

      {mergedUrl && (
        <MergeResult
          url={mergedUrl}
          size={mergedSize}
          format={format}
          onDownload={downloadImage}
        />
      )}
    </div>
  );
}

export default App;
