export interface ImageItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  label: string;
}

export type OutputFormat = "png" | "jpeg";
