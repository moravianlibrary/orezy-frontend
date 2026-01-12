import { Component, inject, output } from '@angular/core';
import { DimColor, GridMode } from '../../app.types';
import { ImagesService } from '../../services/images.service';
import { dimColorDict, gridModeDict } from '../../app.config';

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
  
  dimColorDict: Record<DimColor, string> = dimColorDict;
  dimColorDictKeys = Object.keys(dimColorDict) as DimColor[];

  close() {
    this.closed.emit();
  }

  onBackdropClick() {
    this.backdropClick.emit();
    this.close();

    const imgSvc = this.imagesService;
    if (imgSvc.dialogTitle() === 'Nastavení') imgSvc.gridRadio.set(imgSvc.gridMode());
  }

  toggleOutline(): void {
    const imgSvc = this.imagesService
    imgSvc.outlineTransparent = !imgSvc.outlineTransparent;
    localStorage.setItem('outlineTransparent', `${imgSvc.outlineTransparent}`);
  }
}
