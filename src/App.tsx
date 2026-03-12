import { useState, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.min.mjs";
import { jsPDF } from "jspdf";
import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

interface ImageItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  label: string;
}

type OutputFormat = "png" | "jpeg";

function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [quality, setQuality] = useState(0.85);
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergedSize, setMergedSize] = useState<number>(0);
  const [isMerging, setIsMerging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Render at 2x scale for sharp output
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );
      const imgFile = new File([blob], `${file.name}-page${i}.png`, {
        type: "image/png",
      });
      const item = await loadImage(
        imgFile,
        `${file.name} (p.${i}/${pdf.numPages})`
      );
      items.push(item);
    }

    return items;
  };

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((i) => i.id !== id);
    });
    setMergedUrl(null);
  };

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    const from = dragItemRef.current;
    if (from === null || from === index) {
      setDragOverIndex(null);
      return;
    }
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragOverIndex(null);
    setMergedUrl(null);
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDragOverIndex(null);
  };

  // Use multi-step downscaling (like Lanczos approximation) for better quality
  // when reducing image dimensions. This avoids the blurry result of a single
  // large-ratio drawImage call by halving dimensions iteratively.
  const drawImageHighQuality = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    destY: number
  ) => {
    // If upscaling or ratio close to 1, just draw directly
    if (targetWidth >= img.naturalWidth * 0.5) {
      ctx.drawImage(img, 0, destY, targetWidth, targetHeight);
      return;
    }

    // Step-down approach: halve dimensions until close to target
    const steps: HTMLCanvasElement[] = [];
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;

    // Create first step canvas from original image
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

    // Final draw to destination
    ctx.drawImage(steps[steps.length - 1], 0, destY, targetWidth, targetHeight);
  };

  const mergeImages = useCallback(async () => {
    if (images.length === 0) return;
    setIsMerging(true);

    try {
      // Load all images as HTMLImageElement
      const loadedImgs = await Promise.all(
        images.map(
          (item) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = item.url;
            })
        )
      );

      // Calculate canvas dimensions - use the widest image as the base width
      const maxWidth = Math.max(...images.map((i) => i.width));
      const totalHeight = images.reduce((sum, img) => {
        const scale = maxWidth / img.width;
        return sum + img.height * scale;
      }, 0);

      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = Math.round(totalHeight);
      const ctx = canvas.getContext("2d")!;

      // Fill background white for JPEG (no transparency)
      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw each image vertically
      let y = 0;
      for (let i = 0; i < loadedImgs.length; i++) {
        const img = loadedImgs[i];
        const scale = maxWidth / images[i].width;
        const scaledHeight = Math.round(images[i].height * scale);

        drawImageHighQuality(ctx, img, maxWidth, scaledHeight, y);
        y += scaledHeight;
      }

      // Convert to blob
      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b!),
          mimeType,
          format === "jpeg" ? quality : undefined
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
      // Load all images as HTMLImageElement
      const loadedImgs = await Promise.all(
        images.map(
          (item) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = item.url;
            })
        )
      );

      // Use first image dimensions to determine PDF page size
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

        // Render image to a canvas at original size, then export as JPEG
        // with the user-controlled quality to manage file size
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="app">
      <h1>Image Merge Tool</h1>
      <p className="subtitle">
        Upload images, reorder by drag & drop, merge vertically and download.
      </p>

      {/* Upload area */}
      <div
        className={`upload-area ${isProcessing ? "processing" : ""}`}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("dragover");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("dragover");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("dragover");
          if (isProcessing) return;
          const files = e.dataTransfer.files;
          if (files.length) {
            const dt = new DataTransfer();
            Array.from(files).forEach((f) => {
              if (f.type.startsWith("image/") || f.type === "application/pdf")
                dt.items.add(f);
            });
            if (dt.files.length) {
              processFiles(dt.files);
            }
          }
        }}
      >
        {isProcessing ? (
          <>
            <div className="upload-icon spinning">&#8635;</div>
            <div>Processing PDF...</div>
          </>
        ) : (
          <>
            <div className="upload-icon">+</div>
            <div>Click or drag files here to upload</div>
            <div className="upload-hint">
              Supports PNG, JPG, WebP, PDF, etc.
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          multiple
          onChange={handleFileChange}
          hidden
        />
      </div>

      {/* Image list */}
      {images.length > 0 && (
        <div className="image-list">
          {images.map((item, index) => (
            <div
              key={item.id}
              className={`image-item ${dragOverIndex === index ? "drag-over" : ""}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              <span className="image-index">{index + 1}</span>
              <img src={item.url} alt={item.label} className="thumbnail" />
              <div className="image-info">
                <div className="image-name">{item.label}</div>
                <div className="image-meta">
                  {item.width} x {item.height} &middot;{" "}
                  {formatBytes(item.file.size)}
                </div>
              </div>
              <button
                className="remove-btn"
                onClick={() => removeImage(item.id)}
                title="Remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {images.length > 0 && (
        <div className="controls">
          {/* Format selector */}
          <div className="control-group">
            <label className="control-label">Output Format</label>
            <div className="format-selector">
              <button
                className={`format-btn ${format === "jpeg" ? "active" : ""}`}
                onClick={() => {
                  setFormat("jpeg");
                  setMergedUrl(null);
                }}
              >
                JPG
              </button>
              <button
                className={`format-btn ${format === "png" ? "active" : ""}`}
                onClick={() => {
                  setFormat("png");
                  setMergedUrl(null);
                }}
              >
                PNG
              </button>
            </div>
          </div>

          {/* Quality slider - only for JPEG */}
          {format === "jpeg" && (
            <div className="control-group">
              <label className="control-label">
                Quality:{" "}
                <span className="quality-value">{Math.round(quality * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.01"
                value={quality}
                onChange={(e) => {
                  setQuality(parseFloat(e.target.value));
                  setMergedUrl(null);
                }}
                className="quality-slider"
              />
              <div className="slider-labels">
                <span>Smaller file</span>
                <span>Higher quality</span>
              </div>
            </div>
          )}

          <button
            className="merge-btn"
            onClick={mergeImages}
            disabled={isMerging}
          >
            {isMerging ? "Merging..." : "Merge Images"}
          </button>
          <button
            className="export-pdf-btn"
            onClick={exportAsPdf}
            disabled={isExporting}
          >
            {isExporting ? "Exporting..." : "Export as PDF"}
          </button>
        </div>
      )}

      {/* Result */}
      {mergedUrl && (
        <div className="result">
          <div className="result-header">
            <h2>Result</h2>
            <span className="result-size">{formatBytes(mergedSize)}</span>
          </div>
          <img src={mergedUrl} alt="Merged result" className="result-image" />
          <button className="download-btn" onClick={downloadImage}>
            Download {format === "jpeg" ? "JPG" : "PNG"}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
