import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { InputType } from '../../app.types';

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

  private firstFocus = { x: true, y: true, width: true, height: true, angle: true };
  private holdInterval: any;

  getCurrentIndexImage(): number {
    const images = this.imagesService.displayedImages();
    const current = this.imagesService.mainImageItem();
    return images.findIndex(img => img.name === current.name) + 1;
  }

  onInputBlur(type: InputType, input: HTMLInputElement): void { 
    const rect = this.imagesService.selectedRect;
    if (!rect) return;

    const factor = type === 'angle' ? 1 : 100;

    input.value = rect[type]
      ? ((rect[type] * factor).toFixed(this.decimals))
          .replace(/([.,]\d*?[1-9])0+$/, '$1') // remove unnecessary trailing zeros, but keep the decimal if needed
          .replace(/([.,]0+)$/, '') // remove trailing decimal if it becomes redundant (e.g., "10." → "10")
      : '0';
    
    this.cdr.detectChanges();

    this.firstFocus[type] = true;
  }

  changeInputValue(type: InputType, event: any): void {
    const rect = this.imagesService.selectedRect;
    if (!rect) return;

    let raw = this.parseInputValue(type, event);
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
        rect.angle = ((value + 180) % 360 + 360) % 360 - 180;;
        break;
    }

    this.updateAndRedraw(rect);
  }

  onKeyDown(type: InputType, event: KeyboardEvent, input: HTMLInputElement): void {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();

    const direction = event.key === 'ArrowUp' ? 1 : -1;
    const multiplier = event.shiftKey ? 10 : 1;

    setTimeout(() => this.adjustValue(type, input, direction, multiplier));
  }

  onArrowMouseDown(upDown: 'up' | 'down', event: MouseEvent, type: InputType, input: HTMLInputElement): void {
    event.preventDefault();

    const direction = upDown === 'up' ? 1 : -1;

    setTimeout(() => this.adjustValue(type, input, direction));

    this.holdInterval = setInterval(() => this.adjustValue(type, input, direction), 100);

    const stop = () => {
      clearInterval(this.holdInterval);
      document.removeEventListener('mouseup', stop);
      document.removeEventListener('mouseleave', stop);
    };

    document.addEventListener('mouseup', stop);
    document.addEventListener('mouseleave', stop);
  }

  onFocus(type: InputType, input: HTMLInputElement): void {
    if (this.firstFocus[type]) this.selectAll(type, input);
  }

  private adjustValue(type: InputType, input: HTMLInputElement, direction: 1 | -1,  multiplier: number = 1): void {
    const rect = this.imagesService.selectedRect;
    if (!rect) return;

    const increment = (type === 'angle' ? this.incrementAngle : this.increment) * multiplier;
    const multiplicator = type === 'angle' ? 1 : 100;
    const currentValue = Number(input.value);
    const newValue = (currentValue / multiplicator + direction * increment) * multiplicator;

    this.changeInputValue(type, newValue);
    this.selectAll(type, input);
  }

  private selectAll(type: InputType, input: HTMLInputElement): void {
    this.firstFocus[type] = false;
    setTimeout(() => input.select());
  }

  private parseInputValue(type: InputType, event: any): number {
    if (typeof event === 'number' || typeof event === 'string') return Number(event);
    if (event?.target?.value) return Number(event.target.value);

    const rect = this.imagesService.selectedRect;
    if (!rect) return 0;
    switch (type) {
      case 'x': return (rect.x ?? 0) * 100;
      case 'y': return (rect.y ?? 0) * 100;
      case 'width': return rect.width * 100;
      case 'height': return rect.height * 100;
      case 'angle': return rect.angle;
    }
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
