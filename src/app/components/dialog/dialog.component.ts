import { Component, HostListener, input, output } from '@angular/core';
import { DialogButton } from '../../app.types';

@Component({
  selector: 'app-dialog',
  imports: [],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss'
})
export class DialogComponent {
  title = input<string>('');
  description = input<string | null>(null);
  isContent = input<boolean>(false);
  buttons = input<DialogButton[]>([]);

  closed = output<void>();
  backdropClick = output<void>();

  close() {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.close();
  }

  onBackdropClick() {
    this.backdropClick.emit();
    this.close();
  }
}
