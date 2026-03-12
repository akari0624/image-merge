import { useRef, useState } from "react";
import type { ImageItem } from "../../types";
import { ImageListItem } from "./ImageListItem";

interface ImageListProps {
  images: ImageItem[];
  onReorder: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}

export function ImageList({ images, onReorder, onRemove }: ImageListProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    const from = dragItemRef.current;
    if (from !== null && from !== index) {
      onReorder(from, index);
    }
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDragOverIndex(null);
  };

  if (images.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-2">
      {images.map((item, index) => (
        <ImageListItem
          key={item.id}
          item={item}
          index={index}
          isDragOver={dragOverIndex === index}
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={() => handleDrop(index)}
          onDragEnd={handleDragEnd}
          onRemove={() => onRemove(item.id)}
        />
      ))}
    </div>
  );
}
