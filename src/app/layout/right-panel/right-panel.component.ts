import { Component, ElementRef, inject, ViewChild } from '@angular/core';
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

  increment: number = 0.001;
  incrementAngle: number = 0.01;

  getCurrentIndexImage(): number {
    return this.imagesService.displayedImages().findIndex(img => img.name === this.imagesService.mainImageItem().name) + 1;
  }

  onInputBlur(type: 'x' | 'y' | 'width' | 'height' | 'angle', input: HTMLInputElement): void { 
    if (!this.imagesService.selectedRect) return;

    input.value = this.imagesService.selectedRect[type]
      ? ((this.imagesService.selectedRect[type] * (type === 'angle' ? 1 : 100)).toFixed(type === 'angle' ? 2 : 1)).replace(/([.,]0+)$/, '')
      : '0';
    
    this.cdr.detectChanges();
  }

  onXChange(event: any): void {
    if (!this.imagesService.selectedRect) return;

    let value = parseFloat(typeof event === 'number' || typeof event === 'string' ? Number(event) : (event === null ? 0 : event.target.value)) / 100;
    if (isNaN(value)) value = 0;
    value = parseFloat(value.toFixed(3));

    if (value < 0) value = 0;
    else if (value + this.imagesService.selectedRect.width > 1) value = 1 - this.imagesService.selectedRect.width;
    
    // Recompute center based on x and y
    this.imagesService.selectedRect.x = value;
    this.imagesService.selectedRect.x_center = this.imagesService.selectedRect.x + this.imagesService.selectedRect.width / 2;
    this.imagesService.wasEdited = true;

    // Update state (optional depending on your setup)
    this.imagesService.lastSelectedRect = this.imagesService.selectedRect;
    this.imagesService.currentRects = this.imagesService.currentRects.map(r =>
      r.id === this.imagesService.selectedRect?.id ? this.imagesService.selectedRect : r
    );

    // Redraw the canvas
    this.imagesService.redrawImage();
    this.imagesService.currentRects.forEach(r => this.imagesService.drawRect(this.imagesService.c, this.imagesService.ctx, r));
  }

  onYChange(event: any): void {
    if (!this.imagesService.selectedRect) return;
    
    let value = parseFloat(typeof event === 'number' || typeof event === 'string' ? Number(event) : (event === null ? 0 : event.target.value)) / 100;
    if (isNaN(value)) value = 0;
    value = parseFloat(value.toFixed(3));

    if (value < 0) value = 0;
    else if (value + this.imagesService.selectedRect.height > 1) value = 1 - this.imagesService.selectedRect.height;
    
    // Recompute center based on x and y
    this.imagesService.selectedRect.y = value;
    this.imagesService.selectedRect.y_center = this.imagesService.selectedRect.y + this.imagesService.selectedRect.height / 2;
    this.imagesService.wasEdited = true;

    // Update state (optional depending on your setup)
    this.imagesService.lastSelectedRect = this.imagesService.selectedRect;
    this.imagesService.currentRects = this.imagesService.currentRects.map(r =>
      r.id === this.imagesService.selectedRect?.id ? this.imagesService.selectedRect : r
    );

    // Redraw the canvas
    this.imagesService.redrawImage();
    this.imagesService.currentRects.forEach(r => this.imagesService.drawRect(this.imagesService.c, this.imagesService.ctx, r));
  }

  onWidthChange(event: any): void {
    if (!this.imagesService.selectedRect) return;
    
    let value = parseFloat(typeof event === 'number' || typeof event === 'string' ? Number(event) : (event === null ? 0 : event.target.value)) / 100;
    if (isNaN(value)) value = 0;
    value = parseFloat(value.toFixed(3));

    const x = this.imagesService.selectedRect.x ?? 0;

    if (value < 0) value = 0;
    else if (value + x > 1) value = 1 - x;
    
    // Recompute center based on x and y
    this.imagesService.selectedRect.width = value;
    this.imagesService.selectedRect.x_center = x + value / 2;
    this.imagesService.wasEdited = true;

    // Update state (optional depending on your setup)
    this.imagesService.lastSelectedRect = this.imagesService.selectedRect;
    this.imagesService.currentRects = this.imagesService.currentRects.map(r =>
      r.id === this.imagesService.selectedRect?.id ? this.imagesService.selectedRect : r
    );

    // Redraw the canvas
    this.imagesService.redrawImage();
    this.imagesService.currentRects.forEach(r => this.imagesService.drawRect(this.imagesService.c, this.imagesService.ctx, r));
  }

  onHeightChange(event: any): void {
    if (!this.imagesService.selectedRect) return;
    
    let value = parseFloat(typeof event === 'number' || typeof event === 'string' ? Number(event) : (event === null ? 0 : event.target.value)) / 100;
    if (isNaN(value)) value = 0;
    value = parseFloat(value.toFixed(3));

    const y = this.imagesService.selectedRect.y ?? 0;

    if (value < 0) value = 0;
    else if (value + y > 1) value = 1 - y;
    
    // Recompute center based on x and y
    this.imagesService.selectedRect.height = value;
    this.imagesService.selectedRect.y_center = y + value / 2;
    this.imagesService.wasEdited = true;

    // Update state (optional depending on your setup)
    this.imagesService.lastSelectedRect = this.imagesService.selectedRect;
    this.imagesService.currentRects = this.imagesService.currentRects.map(r =>
      r.id === this.imagesService.selectedRect?.id ? this.imagesService.selectedRect : r
    );

    // Redraw the canvas
    this.imagesService.redrawImage();
    this.imagesService.currentRects.forEach(r => this.imagesService.drawRect(this.imagesService.c, this.imagesService.ctx, r));
  }

  onAngleChange(event: any): void {
    if (!this.imagesService.selectedRect) return;
    
    let value = parseFloat(typeof event === 'number' || typeof event === 'string' ? Number(event) : (event === null ? 0 : event.target.value));
    if (isNaN(value)) value = 0;
    value = parseFloat(value.toFixed(3));

    const y = this.imagesService.selectedRect.angle ?? 0;

    if (value < -179.999) value = 180;
    else if (value > 180) value = -179.999;
    
    // Recompute center based on x and y
    this.imagesService.selectedRect.angle = value;
    this.imagesService.wasEdited = true;

    // Update state (optional depending on your setup)
    this.imagesService.lastSelectedRect = this.imagesService.selectedRect;
    this.imagesService.currentRects = this.imagesService.currentRects.map(r =>
      r.id === this.imagesService.selectedRect?.id ? this.imagesService.selectedRect : r
    );

    // Redraw the canvas
    this.imagesService.redrawImage();
    this.imagesService.currentRects.forEach(r => this.imagesService.drawRect(this.imagesService.c, this.imagesService.ctx, r));
  }

  onKeyDown(type: 'x' | 'y' | 'width' | 'height' | 'angle', event: KeyboardEvent): void {
    const bannedKeys = ['ArrowUp', 'ArrowDown'];
    const key = event.key;
    if (!bannedKeys.includes(key)) return;
    event.preventDefault();

    setTimeout(() => {
      if (!this.imagesService.selectedRect) return;
      console.log(this.imagesService.selectedRect[type]);
      if (!this.imagesService.selectedRect || this.imagesService.selectedRect[type] === 0) return;
      
      const increment = type === 'angle' ? this.incrementAngle : this.increment;
      const multiplicator = type === 'angle' ? 1 : 100;
      if (key === 'ArrowUp') {
        console.log((event.target as HTMLInputElement).value);
        if (type === 'x') this.onXChange((Number((event.target as HTMLInputElement).value)/100 + increment) * 100);
        if (type === 'y') this.onYChange((Number((event.target as HTMLInputElement).value)/100 + increment) * 100);
        if (type === 'width') this.onWidthChange((Number((event.target as HTMLInputElement).value)/100 + increment) * 100);
        if (type === 'height') this.onHeightChange((Number((event.target as HTMLInputElement).value)/100 + increment) * 100);
        if (type === 'angle') this.onAngleChange(Number((event.target as HTMLInputElement).value) + increment);
      } else if (key === 'ArrowDown') {
        if (type === 'x') this.onXChange((Number((event.target as HTMLInputElement).value)/100 - increment) * 100);
        if (type === 'y') this.onYChange((Number((event.target as HTMLInputElement).value)/100 - increment) * 100);
        if (type === 'width') this.onWidthChange((Number((event.target as HTMLInputElement).value)/100 - increment) * 100);
        if (type === 'height') this.onHeightChange((Number((event.target as HTMLInputElement).value)/100 - increment) * 100);
        if (type === 'angle') this.onAngleChange(Number((event.target as HTMLInputElement).value) - increment);
      }
    }, 0);
  }
}
