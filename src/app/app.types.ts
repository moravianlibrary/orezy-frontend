export interface PagePosition {
  xc: number;
  yc: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Page {
  _id: string;
  xc: number;
  yc: number;
  width: number;
  height: number;
  angle: number;
  type: PageType;
  flags: string[];
  left: number;
  right: number;
  top: number;
  bottom: number;
  edited: boolean;
}

export interface AvgPage {
  width: number;
  height: number;
}

export interface ImageItem { // = Instructions
  _id: string;
  url?: string;
  thumbnailUrl?: string;
  edited: boolean;
  flags: string[];
  pages: Page[];
}

export interface DialogButton {
  label: string;
  primary?: boolean;
  action?: () => void;
}

export type InputType = 'left' | 'top' | 'width' | 'height' | 'angle';

export type PageType = 'left' | 'right';

export type ImgOrCanvas = 'image' | 'canvas';
