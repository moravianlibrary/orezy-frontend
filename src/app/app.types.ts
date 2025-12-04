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
  destructive?: boolean;
  action?: () => void;
}

export type InputType = 'left' | 'top' | 'width' | 'height' | 'angle';
export type PageType = 'left' | 'right';
export type ImgOrCanvas = 'image' | 'canvas';


// Cursors
export type MousePos = { x: number, y: number };
export type HitArea = 'none' | 'inside' | 'edge' | 'corner' | 'rotate';
export type EdgeLocalOrientation = 'vertical' | 'horizontal';
export type EdgeSide = 'left' | 'right' | 'top' | 'bottom';
export type CornerName = 'nw' | 'ne' | 'se' | 'sw';
export interface HitInfo {
  area: HitArea;
  page?: Page;
  edgeOrientation?: EdgeLocalOrientation;
  edgeSide?: EdgeSide;
  corner?: CornerName;
}


// Dialog
export type GridMode = 'always' | 'never' | 'when-rotating';
export type DialogContentType = 'settings' | 'shortcuts';
