import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-right-panel',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './right-panel.component.html',
  styleUrl: './right-panel.component.scss'
})
export class RightPanelComponent {
  imagesService = inject(ImagesService);
  cdr = inject(ChangeDetectorRef);

  getCurrentIndexImage(): number {
    return this.imagesService.displayedImages().findIndex(img => img.name === this.imagesService.mainImageItem().name) + 1;
  }

  onInputBlur(type: string, input: HTMLInputElement): void {
    if (!this.imagesService.selectedRect) return;
    let value = 0;

    switch (type) {
      case 'x':
        value = this.imagesService.selectedRect.x ?? 0;
        this.imagesService.selectedRect.x = parseFloat(value.toFixed(3));
        input.value = this.imagesService.selectedRect.x.toString();
        break;
      case 'y':
        value = this.imagesService.selectedRect.y ?? 0;
        this.imagesService.selectedRect.y = parseFloat(value.toFixed(3));
        input.value = this.imagesService.selectedRect.y.toString();
        break;
      case 'width':
        value = this.imagesService.selectedRect.width ?? 0;
        this.imagesService.selectedRect.width = parseFloat(value.toFixed(3));
        input.value = this.imagesService.selectedRect.width.toString();
        break;
      case 'height':
        value = this.imagesService.selectedRect.height ?? 0;
        this.imagesService.selectedRect.height = parseFloat(value.toFixed(3));
        input.value = this.imagesService.selectedRect.height.toString();
        break;
      case 'angle':
        value = this.imagesService.selectedRect.angle ?? 0;
        this.imagesService.selectedRect.angle = parseFloat(value.toFixed(3));
        input.value = this.imagesService.selectedRect.angle.toString();
        break;
    }
    
    this.cdr.detectChanges();
  }
}
