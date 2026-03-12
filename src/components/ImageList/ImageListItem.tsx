import type { ImageItem } from "../../types";
import { formatBytes } from "../../utils/format-bytes";

interface ImageListItemProps {
  item: ImageItem;
  index: number;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onRemove: () => void;
}

export function ImageListItem({
  item,
  index,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
}: ImageListItemProps) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 border rounded-lg cursor-grab active:cursor-grabbing transition-colors
        ${isDragOver ? "border-brand bg-brand/10" : "border-border-dark dark:border-border-dark light:border-border-light"}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className="text-xs text-gray-500 min-w-6 text-center">
        {index + 1}
      </span>
      <img
        src={item.url}
        alt={item.label}
        className="w-14 h-14 object-cover rounded-md shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{item.label}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {item.width} x {item.height} &middot; {formatBytes(item.file.size)}
        </div>
      </div>
      <button
        className="bg-transparent border-none text-xl text-gray-400 cursor-pointer px-2 py-1 leading-none rounded hover:text-remove hover:bg-remove/10"
        onClick={onRemove}
        title="Remove"
      >
        &times;
      </button>
    </div>
  );
}
