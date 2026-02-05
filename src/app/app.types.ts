/* ------------------------------
    DASHBOARD
  ------------------------------ */
export type DashboardPage = 'my-groups' | 'my-groups-titles' | 'groups' | 'users';
export type PermissionType = 'read' | 'write' | 'manage';

export interface Group {
  _id: string;
  name: string;
  api?: string;
  description: string;
  created_at: string;
  modified_at: string;
  title_count: number;
  permission: PermissionType;
  users?: UserInGroup[];
}

export interface GroupDetail {
  _id: string;
  name: string;
  description: string;
  created_at: string;
  modified_at: string;
  titles: Title[];
}

export interface NewGroup {
  id: string;
  api?: string;
}

export interface Title {
  _id: string;
  created_at: string;
  modified_at: string;
  state: TitleState;
}

export interface TitleDetail {
  _id: string;
  crop_method: string;
  created_at: string;
  modified_at: string;
  modified_by: string;
  state: TitleState;
  scans: ImageItem[];
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

export interface UserInGroup {
  _id: string;
  full_name: string;
  permission: PermissionType;
}

export interface Position {
  x: number;
  y: number;
}



/* ------------------------------
    EDITOR
  ------------------------------ */
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
export type GridMode = 'always' | 'never' | 'when-rotating';
export type DimColor = 'Černá' | 'Červená';
export type TitleState = 'new' | 'scheduled' | 'in_progress' | 'failed' | 'ready' | 'user_approved' | 'completed';

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

// Zoom
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}



/* ------------------------------
    UI
  ------------------------------ */

// Drawer
export type DrawerContentType = 'groups' | 'users';
export interface DrawerButton {
  label: string;
  primary?: boolean;
  destructive?: boolean;
  action?: () => void;
}

// Dialog
export type DialogContentType = 'settings' | 'shortcuts' | 'new-group' | 'delete-group';
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
