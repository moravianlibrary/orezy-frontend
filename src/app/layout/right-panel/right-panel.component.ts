import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { InputType, Rect } from '../../app.types';
import { defer, degreeToRadian } from '../../utils/utils';

@Component({
  selector: 'app-right-panel',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './right-panel.component.html',
  styleUrl: './right-panel.component.scss'
})
export class RightPanelComponent {
  imagesService = inject(ImagesService);
  private cdr = inject(ChangeDetectorRef);

  rotationDirection: number = 1;
  private increment: number = 0.001;
  private incrementAngle: number = this.increment * 100;
  private decimals: number = 2;

  private firstFocus = { left: true, top: true, width: true, height: true, angle: true };
  private holdInterval: any;

  getCurrentIndexImage(): number {
    const images = this.imagesService.displayedImages();
    const current = this.imagesService.mainImageItem();
    return images.findIndex(img => img.name === current.name) + 1;
  }

  changeInputValue(type: InputType, event: any): void {
    const imgSvc = this.imagesService;
    const rect = imgSvc.selectedRect;
    if (!rect) return;

    imgSvc.lastLeftInput = rect.left;
    imgSvc.lastTopInput = rect.top;
    imgSvc.lastWidthInput = rect.width;
    imgSvc.lastHeightInput = rect.height;

    let raw = this.parseInputValue(type, event);
    let value = type === 'angle' ? raw : raw / 100;
    if (isNaN(value)) value = 0;

    value = parseFloat(value.toFixed(this.decimals + 2));

    const cw = imgSvc.c.width;
    const ch = imgSvc.c.height;
    const ratio = cw / ch;
    const inverseRatio = ch / cw;

    switch (type) {
      case 'left':
        const boundWidth = Math.abs(rect.left - rect.right);
        value = this.clamp(value, 0, 1 - boundWidth);
        const deltaX = -(imgSvc.lastLeftInput - value)
        rect.x_center = rect.x_center + deltaX;
        rect.right = rect.right + deltaX;
        rect.left = value;
        imgSvc.lastLeftInput = value;
        break;
      case 'top':
        const boundHeight = Math.abs(rect.top - rect.bottom);
        value = this.clamp(value, 0, 1 - boundHeight);
        const deltaY = -(imgSvc.lastTopInput - value)
        rect.y_center = rect.y_center + deltaY;
        rect.bottom = rect.bottom + deltaY;
        rect.top = value;
        imgSvc.lastTopInput = value;
        break;
      case 'width':
        const handleAligned = (isHorizontal: boolean, reverse: boolean) => {
          value = this.clamp(value, 0, isHorizontal
            ? reverse ? rect.right : 1 - rect.left
            : (reverse ? rect.bottom : (1 - rect.top)) * inverseRatio);
          const delta = (imgSvc.lastWidthInput - value) * (reverse ? 1 : -1);
          
          if (isHorizontal) {
            rect.x_center += delta / 2;
            reverse
              ? rect.left = this.clamp(rect.left + delta)
              : rect.right = this.clamp(rect.right + delta);
          } else {
            rect.y_center += (delta / 2) * ratio;
            reverse
              ? rect.top = this.clamp(value * ratio >= rect.bottom ? 0 : rect.top + delta * ratio)
              : rect.bottom = this.clamp(rect.bottom + delta * ratio);
          }

          rect.width = value;
          imgSvc.lastWidthInput = value;
        };

        const handleRotated = (angle: number) => {
          const getOrientation = (angle: number) => {
            if (angle > 0 && angle < 90)  return { signX: +1, signY: +1, ref: 'bottom-right', baseAngle: angle };
            if (angle > 90)               return { signX: -1, signY: +1, ref: 'bottom-left',  baseAngle: angle - 90 };
            if (angle < -90)              return { signX: -1, signY: -1, ref: 'top-left',     baseAngle: -angle - 90 };
            if (angle < 0 && angle > -90) return { signX: +1, signY: -1, ref: 'top-right',    baseAngle: -angle };
            return null;
          };

          const o = getOrientation(angle);
          if (!o) return;

          const rad = degreeToRadian(o.baseAngle);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const toRight = o.signX > 0;
          const toBottom = o.signY > 0;
          const goniom = toRight ? cos : sin;
          const inverseGoniom = toRight ? sin : cos;

          const rectWidthOriginal = rect.width;
          const rectLeftOriginal = rect.left;
          const rectRightOriginal = rect.right;
          const rectTopOriginal = rect.top;
          const rectBottomOriginal = rect.bottom;

          const dW = -(imgSvc.lastWidthInput - value);
          const limitSide = toRight ? 'right' : 'left';
          let newSide = rect[limitSide] + dW * (toRight ? cos : -sin);
          rect[limitSide] = newSide;
          let dX = (dW / 2) * goniom;
          
          rect.width = value;
          let adjustedDeltaWidth = dW;
          let adjustedDeltaX = dX;

          if (toRight ? newSide > 1 : newSide < 0) {
            rect.width = rectWidthOriginal + ((toRight ? 1 - rectRightOriginal : rectLeftOriginal) / goniom);
            rect[limitSide] = toRight ? 1 : 0;
            adjustedDeltaWidth = rect.width - imgSvc.lastWidthInput;
            adjustedDeltaX = (adjustedDeltaWidth / 2) * goniom;
          }

          let deltaY = (adjustedDeltaWidth / 2) * inverseGoniom;
          let adjustedDeltaY = deltaY;
          const secondLimitSide = toBottom ? 'bottom' : 'top';
          let secondNewSide = rect[secondLimitSide] + adjustedDeltaWidth * inverseGoniom * ratio * o.signY;
          rect[secondLimitSide] = secondNewSide;

          if (toBottom ? secondNewSide > 1 : secondNewSide < 0) {
            rect.width = rectWidthOriginal + ((toBottom ? (1 - rectBottomOriginal) : rectTopOriginal) / inverseGoniom) * inverseRatio;
            rect[secondLimitSide] = toBottom ? 1 : 0;
            adjustedDeltaWidth = rect.width - imgSvc.lastWidthInput;
            adjustedDeltaX = (adjustedDeltaWidth / 2) * goniom;
            adjustedDeltaY = (adjustedDeltaWidth / 2) * inverseGoniom;
            toRight
              ? rect.right = rectRightOriginal + adjustedDeltaWidth * cos
              : rect.left = rectLeftOriginal - adjustedDeltaWidth * sin;
          }

          rect.x_center = rect.x_center + adjustedDeltaX * o.signX;
          rect.y_center = rect.y_center + adjustedDeltaY * o.signY * ratio;
          imgSvc.lastWidthInput = value;
        };

        // --- Dispatch by angle ---
        switch (rect.angle) {
          case 0:
            handleAligned(true, false);
            break;
          case -180:
            handleAligned(true, true);
            break;
          case 90:
            handleAligned(false, false);
            break;
          case -90:
            handleAligned(false, true);
            break;
          default:
            handleRotated(rect.angle);
            break;
        }

        break;
      case 'height':
        const handleAlignedHeight = (isHorizontal: boolean, reverse: boolean) => {
          value = this.clamp(value, 0, isHorizontal
            ? reverse ? rect.bottom : 1 - rect.top
            : (reverse ? rect.right : (1 - rect.left)) * ratio);
          const delta = (imgSvc.lastHeightInput - value) * (reverse ? 1 : -1);
          
          if (isHorizontal) {
            rect.y_center += delta / 2;
            reverse
              ? rect.top = this.clamp(rect.top + delta)
              : rect.bottom = this.clamp(rect.bottom + delta);
          } else {
            rect.x_center += (delta / 2) * inverseRatio;
            reverse
              ? rect.left = this.clamp(value * inverseRatio >= rect.right ? 0 : rect.left + delta * inverseRatio)
              : rect.right = this.clamp(rect.right + delta * inverseRatio);
          }

          rect.height = value;
          imgSvc.lastHeightInput = value;
        };

        const handleRotatedHeight = (angle: number) => {
          const getOrientation = (angle: number) => {
            if (angle > 0 && angle < 90)  return { signX: -1, signY: +1, ref: 'bottom-left', baseAngle: 90 - angle };
            if (angle > 90)               return { signX: -1, signY: -1, ref: 'top-left',  baseAngle: angle - 90 };
            if (angle < -90)              return { signX: +1, signY: -1, ref: 'top-right', baseAngle: 180 + angle };
            if (angle < 0 && angle > -90) return { signX: +1, signY: +1, ref: 'bottom-right',    baseAngle: -angle };
            return null;
          };

          const o = getOrientation(angle);
          if (!o) return; 

          const rad = degreeToRadian(o.baseAngle);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const toRight = o.signX > 0;
          const toBottom = o.signY > 0;
          const goniom = toRight ? cos : sin;
          const inverseGoniom = toRight ? sin : cos;

          const rectHeightOriginal = rect.height;
          const rectLeftOriginal = rect.left;
          const rectRightOriginal = rect.right;
          const rectTopOriginal = rect.top;
          const rectBottomOriginal = rect.bottom;

          const dH = -(imgSvc.lastHeightInput - value);
          const limitSide = toBottom ? 'bottom' : 'top';
          let newSide = rect[limitSide] + dH * goniom * o.signY;
          rect[limitSide] = newSide;
          let dY = (dH / 2) * goniom;
          
          rect.height = value;
          let adjustedDeltaHeight = dH;
          let adjustedDeltaY = dY;

          if (toBottom ? newSide > 1 : newSide < 0) {
            rect.height = rectHeightOriginal + ((toBottom ? 1 - rectBottomOriginal : rectTopOriginal) / goniom);
            rect[limitSide] = toBottom ? 1 : 0;
            adjustedDeltaHeight = rect.height - imgSvc.lastHeightInput;
            adjustedDeltaY = (adjustedDeltaHeight / 2) * goniom;
          }

          let deltaX = (adjustedDeltaHeight / 2) * inverseGoniom;
          let adjustedDeltaX = deltaX;
          const secondLimitSide = toRight ? 'right' : 'left';
          let secondNewSide = rect[secondLimitSide] + adjustedDeltaHeight * inverseGoniom * inverseRatio * o.signX;
          rect[secondLimitSide] = secondNewSide;

          if (toRight ? secondNewSide > 1 : secondNewSide < 0) {
            rect.height = rectHeightOriginal + ((toRight ? (1 - rectRightOriginal) : rectLeftOriginal) / inverseGoniom) * ratio;
            rect[secondLimitSide] = toRight ? 1 : 0;
            adjustedDeltaHeight = rect.height - imgSvc.lastHeightInput;
            adjustedDeltaY = (adjustedDeltaHeight / 2) * goniom;
            adjustedDeltaX = (adjustedDeltaHeight / 2) * inverseGoniom;
            toBottom
              ? rect.bottom = rectBottomOriginal + adjustedDeltaHeight * cos
              : rect.top = rectTopOriginal - adjustedDeltaHeight * sin;
          }

          rect.y_center = rect.y_center + adjustedDeltaY * o.signY;
          rect.x_center = rect.x_center + adjustedDeltaX * o.signX * inverseRatio;
          imgSvc.lastHeightInput = value;
        };

        // --- Dispatch by angle ---
        switch (rect.angle) {
          case 0:
            handleAlignedHeight(true, false);
            break;
          case -180:
            handleAlignedHeight(true, true);
            break;
          case 90:
            handleAlignedHeight(false, true);
            break;
          case -90:
            handleAlignedHeight(false, false);
            break;
          default:
            handleRotatedHeight(rect.angle);
            break;
        }

        break;
      case 'angle':
        const newAngle = ((value + 180) % 360 + 360) % 360 - 180;

        const canRotateRect = (rect: Rect, newAngle: number): boolean => {
          const bounds = imgSvc.computeBounds(rect.x_center, rect.y_center, rect.width, rect.height, newAngle);
          return (
            bounds.left >= 0 &&
            bounds.right <= 1 &&
            bounds.top >= 0 &&
            bounds.bottom <= 1
          );
        }

        if (canRotateRect(rect, newAngle)) {
          rect.angle = newAngle;
        } else {
          this.rotationDirection = Math.sign(newAngle - rect.angle);
          const step = this.rotationDirection * (0.1 ** this.decimals);
          let tempAngle = rect.angle;
          while (canRotateRect(rect, tempAngle + step)) {
            tempAngle += step;
          }
          rect.angle = tempAngle;
        }

        const bounds = imgSvc.computeBounds(rect.x_center, rect.y_center, rect.width, rect.height, rect.angle);

        rect.left = bounds.left;
        rect.right = bounds.right;
        rect.top = bounds.top;
        rect.bottom = bounds.bottom;

        break;
    }

    this.updateAndRedraw(rect);
  }

  onKeyDown(type: InputType, event: KeyboardEvent, input: HTMLInputElement): void {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();

    const direction = event.key === 'ArrowUp' ? 1 : -1;
    const multiplier = event.shiftKey ? 10 : 1;

    defer(() => this.adjustValue(type, input, direction, multiplier));
  }

  onArrowMouseDown(upDown: 'up' | 'down', event: MouseEvent, type: InputType, input: HTMLInputElement): void {
    event.preventDefault();

    const direction = upDown === 'up' ? 1 : -1;

    defer(() => this.adjustValue(type, input, direction));

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

  // computeMaxDimension(dimension: 'width' | 'height'): number {
  //   const rect = this.imagesService.selectedRect;
  //   if (!rect) return 0;

  //   const { x_center, y_center, width, height, angle } = rect;
  //   let size = 1;

  //   while (size > 0) {
  //     const testWidth = dimension === 'width' ? size : width;
  //     const testHeight = dimension === 'height' ? size : height;
  //     const bounds = this.imagesService.computeBounds(x_center, y_center, testWidth, testHeight, degreeToRadian(-angle));

  //     if (bounds.left >= 0 && bounds.right <= 1 && bounds.top >= 0 && bounds.bottom <= 1) {
  //       return size;
  //     }

  //     size -= this.increment;
  //   }

  //   return 0;
  // }

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
    defer(() => input.select());
  }

  private parseInputValue(type: InputType, event: any): number {
    if (typeof event === 'number' || typeof event === 'string') return Number(event);
    if (event?.target?.value) return Number(event.target.value);

    const rect = this.imagesService.selectedRect;
    if (!rect) return 0;
    switch (type) {
      case 'left': return rect.left * 100;
      case 'top': return rect.top * 100;
      case 'width': return rect.width * 100;
      case 'height': return rect.height * 100;
      case 'angle': return rect.angle;
    }
  }

  private clamp(value: number, min: number = 0, max: number = 1): number {
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
