import { Component, inject, output } from '@angular/core';
import { GridMode } from '../../app.types';
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

    const imgSvc = this.imagesService;
    if (imgSvc.dialogTitle() === 'Nastavení') imgSvc.gridRadio.set(imgSvc.gridMode());
  }
}
