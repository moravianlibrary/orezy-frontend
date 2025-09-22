export interface ImageItem {
  name: string;
  url: string;
  low_confidence: boolean;
  bad_sides_ratio: boolean;
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
  low_confidence: boolean;
  bad_sides_ratio: boolean;
}
