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
  private cdr = inject(ChangeDetectorRef);

  private increment: number = 0.001;
  private incrementAngle: number = this.increment * 100;
  private decimals: number = 2;

  getCurrentIndexImage(): number {
    const images = this.imagesService.displayedImages();
    const current = this.imagesService.mainImageItem();
    return images.findIndex(img => img.name === current.name) + 1;
  }

  onInputBlur(type: 'x' | 'y' | 'width' | 'height' | 'angle', input: HTMLInputElement): void { 
    const rect = this.imagesService.selectedRect;
    if (!rect) return;

    const factor = type === 'angle' ? 1 : 100;

    input.value = rect[type]
      ? ((rect[type] * factor).toFixed(this.decimals))
          .replace(/([.,]\d*?[1-9])0+$/, '$1') // remove unnecessary trailing zeros, but keep the decimal if needed
          .replace(/([.,]0+)$/, '') // remove trailing decimal if it becomes redundant (e.g., "10." → "10")
      : '0';
    
    this.cdr.detectChanges();
  }

  changeInputValue(type: 'x' | 'y' | 'width' | 'height' | 'angle', event: any): void {
    const rect = this.imagesService.selectedRect;
    if (!rect) return;

    let raw = this.parseInputValue(event);
    let value = type === 'angle' ? raw : raw / 100;
    if (isNaN(value)) value = 0;

    value = parseFloat(value.toFixed(this.decimals + 2));

    switch (type) {
      case 'x':
        value = this.clamp(value, 0, 1 - rect.width);
        rect.x = value;
        rect.x_center = rect.x + rect.width / 2;
        break;
      case 'y':
        value = this.clamp(value, 0, 1 - rect.height);
        rect.y = value;
        rect.y_center = rect.y + rect.height / 2;
        break;
      case 'width':
        value = this.clamp(value, 0, 1 - (rect.x ?? 0));
        rect.width = value;
        rect.x_center = (rect.x ?? 0) + rect.width / 2;
        break;
      case 'height':
        value = this.clamp(value, 0, 1 - (rect.y ?? 0));
        rect.height = value;
        rect.y_center = (rect.y ?? 0) + rect.height / 2;
        break;
      case 'angle':
        if (value < -179.99) value = 180;
        else if (value > 180) value = -179.99;
        rect.angle = value;
        break;
    }

    this.updateAndRedraw(rect);
  }

  onKeyDown(type: 'x' | 'y' | 'width' | 'height' | 'angle', event: KeyboardEvent): void {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();

    setTimeout(() => {
      const rect = this.imagesService.selectedRect;
      if (!rect) return;

      const increment = type === 'angle' ? this.incrementAngle : this.increment;
      const multiplicator = type === 'angle' ? 1 : 100;
      const currentValue = Number((event.target as HTMLInputElement).value);
      const delta = event.key === 'ArrowUp' ? increment : -increment;
      const newValue = (currentValue / multiplicator + delta) * multiplicator;

      this.changeInputValue(type, newValue);
    });
  }

  private parseInputValue(event: any): number {
    if (typeof event === 'number' || typeof event === 'string') return Number(event);
    if (event?.target?.value) return Number(event.target.value);
    return 0;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private updateAndRedraw(rect: any): void {
    const imgSvc = this.imagesService;
    imgSvc.wasEdited = true;
    imgSvc.lastSelectedRect = rect;
    imgSvc.currentRects = imgSvc.currentRects.map(r => (r.id === rect.id ? rect : r));

    imgSvc.redrawImage();
    imgSvc.currentRects.forEach(r => imgSvc.drawRect(imgSvc.c, imgSvc.ctx, r));
  }
}
