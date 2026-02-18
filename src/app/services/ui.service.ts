import { Injectable, signal } from '@angular/core';
import { DialogButton, DialogContentType, DrawerButton, DrawerContentType, Toast, ToastType } from '../app.types';
import { defer, focusMainWrapper } from '../utils/utils';
import { OverlayScrollbars } from 'overlayscrollbars';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  private osInstance?: ReturnType<typeof OverlayScrollbars>;
  
  /* ------------------------------
    TOAST MESSAGES
  ------------------------------ */
  toasts = signal<Toast[]>([]);
  private toastDuration: number = 3000;
  private toastErrorDuration: number = 300000;
  
  showToast(message: string, opts?: { type?: ToastType; duration?: number }): string {
    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      message,
      type: opts?.type ?? 'info',
      duration: opts?.duration ?? (opts?.type === 'error' ? this.toastErrorDuration : this.toastDuration),
    };

    this.toasts.update((prev) => [...prev, toast]);
    window.setTimeout(() => this.dismissToast(id), toast.duration);

    return id;
  }

  dismissToast(id: string) {
    this.toasts.update((prev) => prev.filter((t) => t.id !== id));
    focusMainWrapper();
  }

  clearAllToasts() {
    this.toasts.set([]);
  }


  /* ------------------------------
    DIALOG
  ------------------------------ */
  dialogOpened: boolean = false;
  dialogOpen = signal<boolean>(false);
  dialogTitle = signal<string>('');
  dialogContent = signal<boolean>(false);
  dialogContentType = signal<DialogContentType | null>(null);
  dialogDescription = signal<string | null>(null);
  dialogButtons = signal<DialogButton[]>([]);
  
  openDialog(): void {
    this.dialogOpen.set(true);
    this.dialogOpened = true;

    defer(() => {
      const dialogContentType = this.dialogContentType();
      const id = ['settings'].includes(dialogContentType as string)
        ? 'dialog-body'
        : `${dialogContentType}-content-wrapper`;
      const el = document.getElementById(id) as HTMLElement;
      this.osInstance = OverlayScrollbars(el, {
        overflow: { x: 'hidden', y: 'scroll' },
        scrollbars: {
          theme: 'os-theme-orezy',
          autoHide: 'leave',
          autoHideDelay: 250,
          dragScroll: true,
          clickScroll: true,
        },
      });
      el.classList.remove('os-pending');
      if (document.activeElement?.className !== 'main-wrapper' && document.querySelector('.main-wrapper')) focusMainWrapper();
    }, 100);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.dialogOpened = false;
  }


  /* ------------------------------
    DRAWER
  ------------------------------ */
  drawerOpen = signal<boolean>(false);
  drawerEditMode = signal<boolean>(false);
  drawerTitle = signal<string>('');
  drawerContent = signal<boolean>(false);
  drawerContentType = signal<DrawerContentType | null>(null);
  drawerDescription = signal<string | null>(null);
  drawerButtons = signal<DrawerButton[]>([]);
  
  openDrawer(): void {
    this.drawerOpen.set(true);
    this.drawerEditMode.set(false);

    defer(() => {
      const el = document.getElementById('drawer-body') as HTMLElement;
      this.osInstance = OverlayScrollbars(el, {
        overflow: { x: 'hidden', y: 'scroll' },
        scrollbars: {
          theme: 'os-theme-orezy',
          autoHide: 'leave',
          autoHideDelay: 250,
          dragScroll: true,
          clickScroll: true,
        },
      });
      el.classList.remove('os-pending');
    }, 100);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.drawerEditMode.set(false);
  }
}
