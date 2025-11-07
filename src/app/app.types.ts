export interface ImageItem {
  name?: string;
  url?: string;
  crop_part?: number;
  low_confidence?: boolean;
  bad_sides_ratio?: boolean;
  edited?: boolean;
  rects?: Rect[];
}

export interface ImageFlags {
  low_confidence?: boolean;
  bad_sides_ratio?: boolean;
}

export interface Transformation {
  image_path: string;
  x_center: number;
  y_center: number;
  width: number;
  height: number;
  confidence: number;
  angle: number;
  crop_part: number;
  color: string;
  low_confidence: boolean;
  bad_sides_ratio: boolean;
}

export interface Rect {
  id: string;
  x_center: number;
  y_center: number;
  x?: number;
  y?: number;
  width: number;
  height: number;
  angle: number;
  crop_part: number;
  color: string;
  edited: boolean;
}

export interface AvgRect {
  width: number;
  height: number;
}

export type InputType = 'x' | 'y' | 'width' | 'height' | 'angle';
