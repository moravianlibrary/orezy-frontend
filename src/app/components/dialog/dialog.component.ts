import { Component, HostListener, inject, output } from '@angular/core';
import { GridMode } from '../../app.types';
import { DialogService } from '../../services/dialog.service';
import { ImagesService } from '../../services/images.service';
import { gridModeDict } from '../../app.config';

@Component({
  selector: 'app-dialog',
  imports: [],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss'
})
export class DialogComponent {
  imagesService = inject(ImagesService);
  dialogService = inject(DialogService);
  
  closed = output<void>();
  backdropClick = output<void>();

  gridModeDict: Record<GridMode, string> = gridModeDict;
  gridModeDictKeys = Object.keys(gridModeDict) as GridMode[];

  close() {
    this.closed.emit();
  }

  onBackdropClick() {
    this.backdropClick.emit();
    this.close();
  }
}
