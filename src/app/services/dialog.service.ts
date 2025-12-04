import { Injectable, signal } from '@angular/core';
import { DialogButton, DialogContentType } from '../app.types';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  dialogOpened: boolean = false;
  dialogOpen = signal<boolean>(false);
  dialogTitle = signal<string>('');
  dialogContent = signal<boolean>(false);
  dialogContentType = signal<DialogContentType | null>(null);
  dialogDescription = signal<string | null>(null);
  dialogButtons = signal<DialogButton[]>([]);

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.dialogOpened = false;
  }
}