export interface Image {
  name: string;
  url: string;
  lowConfidence: boolean;
  badSidesRatio: boolean;
}

export interface ImageFlags {
  lowConfidence?: boolean;
  badSidesRatio?: boolean;
}

export interface Transformation {
  image_path: string;
  x_center: number;
  y_center: number;
  width: number;
  height: number;
  confidence: number;
  angle: number;
}
