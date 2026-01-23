// Dashboard
export interface Group {
  _id: string;
  short_name: string;
  full_name: string;
  description: string;
  title_ids: string[];
}

export interface Title {
  _id: string;
  created_at: string;
  modified_at: string;
  state: string;
}

export interface Permission {
  group_id: string;
  permission: string;
  created_at: string;
}

export interface User {
  _id: string;
  email: string;
  full_name: string;
  role: Role;
  permissions: Permission[];
}


// Editor
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

export interface ImageItem {
  _id: string;
  url?: string;
  thumbnailUrl?: string;
  edited: boolean;
  flags: string[];
  pages: Page[];
}

export interface ImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ScanType = 'all' | 'flagged' | 'edited' | 'ok';
export type PageNumberType = 'all' | 'single' | 'double';
export type PageType = 'single' | 'left' | 'right';
export type InputType = 'left' | 'top' | 'width' | 'height' | 'angle';
export type Role = 'admin' | 'user';


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
export type DimColor = 'Černá' | 'Červená';
export type DialogContentType = 'settings' | 'shortcuts';
export interface DialogButton {
  label: string;
  primary?: boolean;
  destructive?: boolean;
  action?: () => void;
}


// Toast messages
export type ToastType = 'info' | 'success' | 'error';
export interface Toast {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
}


// Zoom
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}
