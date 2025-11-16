import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImagesService } from '../../services/images.service';
import { ButtonGroupComponent } from '../../components/button-group/button-group.component';
import { degreeToRadian } from '../../utils/utils';
import { Rect } from '../../app.types';

@Component({
  selector: 'app-main',
  imports: [RouterOutlet, ButtonGroupComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  imagesService = inject(ImagesService);

  ngAfterViewInit(): void {
    const imgSvc = this.imagesService;
    
    // Set canvas
    imgSvc.c = document.getElementById('main-canvas') as HTMLCanvasElement;
    imgSvc.ctx = imgSvc.c.getContext('2d')!;
    
    // Set main image for full mode
    if (imgSvc.mode() === 'full') {
      const [firstFlagged] = imgSvc.flaggedImages();
      if (firstFlagged) imgSvc.setMainImage(firstFlagged);
    }

    // Attach event handlers
    this.attachMainImageEvents();
    this.attachMainCanvasEvents();
    ['#main-container', 'app-left-panel' , 'app-bottom-panel', 'app-right-panel'].forEach(el => this.attachEventsRest(document.querySelector(el)));
  }

  private attachEventsRest(el: HTMLElement | null): void {
    if (!el) return;
    const imgSvc = this.imagesService;

    el.onclick = (ev) => {
      const tagName = (ev.target as HTMLElement).tagName;
      if (tagName === 'APP-RIGHT-PANEL') return;
      if (tagName !== 'APP-LEFT-PANEL' && tagName !== 'DIV' && tagName !== 'APP-RIGHT-PANEL' && tagName !== 'APP-BOTTOM-PANEL') return;
      if (el.tagName === 'DIV' && tagName !== 'DIV') return;
      if (imgSvc.mode() === 'single' || !imgSvc.selectedRect) return;
      imgSvc.selectedRect = null;
      imgSvc.lastRectCursorIsInside = null;
      imgSvc.editable.set(false);
      imgSvc.toggleMainImageOrCanvas();
      this.hoveringRect('');
      imgSvc.updateMainImageItemAndImages();
    };

    el.onmousemove = (ev) => {
      if (el.tagName === 'DIV' && (ev.target as HTMLElement).tagName !== 'DIV') return;
      const rectId = this.rectIdCursorInside(ev);
      const insideRect = Boolean(rectId);
      this.imagesService.editable.set(insideRect);
      this.imagesService.toggleMainImageOrCanvas();
    };
  }

  private attachMainImageEvents(): void {
    const el = document.getElementById('main-image');
    if (!el) return;

    el.onmousemove = (ev) => {
      if ((ev.target as HTMLElement).tagName !== 'IMG') return;
      const rectId = this.rectIdCursorInside(ev);
      const insideRect = Boolean(rectId);
      this.imagesService.editable.set(insideRect);
      this.imagesService.toggleMainImageOrCanvas();
    };
  }

  private attachMainCanvasEvents(): void {
    const el = document.getElementById('main-canvas');
    if (!el) return;

    ['mousedown', 'mousemove', 'mouseup'].forEach(eventType => {
      el.addEventListener(eventType, (ev) => this.handleCanvasInteraction(ev as MouseEvent, el));
    });
  }

  // ---------- RECTANGLE LOGIC ----------
  private rectIdCursorInside(e: MouseEvent): string {
    const imgSvc = this.imagesService;
    const mainElement = document.getElementById(imgSvc.editable() ? 'main-canvas' : 'main-image') as HTMLElement;
    if (!mainElement) return '';

    const rect = mainElement.getBoundingClientRect();
    const [x, y] = [e.clientX - rect.left, e.clientY - rect.top];

    const hit = imgSvc.selectedRect && imgSvc.currentRects.filter(r => this.isPointInRect(x, y, r)).includes(imgSvc.selectedRect)
      ? imgSvc.selectedRect
      : imgSvc.currentRects.find(r => this.isPointInRect(x, y, r));
    
    return hit?.id ?? '';
  }

  private isPointInRect(x: number, y: number, r: Rect): boolean {
    const c = this.imagesService.c;
    const [centerX, centerY] = [c.width * r.x_center, c.height * r.y_center];
    const [width, height] = [c.width * r.width, c.height * r.height];
    const angle = degreeToRadian(r.angle);
    const [halfW, halfH] = [width / 2, height / 2];
    const dx = x - centerX;
    const dy = y - centerY;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    return localX >= -halfW && localX <= halfW && localY >= -halfH && localY <= halfH;
  }

  private hoveringRect(hoveredRectId: string): void {
    const imgSvc = this.imagesService;
    imgSvc.redrawImage();
    imgSvc.currentRects.forEach(r => imgSvc.drawRect(imgSvc.c, imgSvc.ctx, r, hoveredRectId));
  }

  private handleCanvasInteraction(ev: MouseEvent, el: HTMLElement): void {
    if ((ev.target as HTMLElement).tagName !== 'CANVAS') return;
    const imgSvc = this.imagesService;
    const rectId = this.rectIdCursorInside(ev);
    const insideRect = Boolean(rectId);

    if (ev.type === 'mousedown') {
      imgSvc.selectedRect = imgSvc.currentRects.find(r => r.id === rectId) || null;
      imgSvc.lastRectCursorIsInside = imgSvc.currentRects.find(r => r.id === rectId) ?? null;
      imgSvc.editable.set(insideRect);
      imgSvc.toggleMainImageOrCanvas();
      this.hoveringRect(rectId);
      imgSvc.updateMainImageItemAndImages();
    }

    if (ev.type === 'mousemove') {
      if (imgSvc.lastRectCursorIsInside?.id === rectId && !imgSvc.selectedRect) return;
      if (!imgSvc.isDragging) {
        imgSvc.lastRectCursorIsInside = imgSvc.currentRects.find(r => r.id === rectId) ?? null;
        imgSvc.editable.set(insideRect);
        imgSvc.toggleMainImageOrCanvas();
        this.hoveringRect(rectId);
      }
    }

    // Drag rect
    el.style.cursor = insideRect ? 'move' : 'initial';
    if (insideRect) {
      if (ev.type === 'mousedown') {
        const rect = imgSvc.selectedRect;
        if (!rect) return;

        imgSvc.isDragging = true;
        imgSvc.mouseDownCurPos = { x: ev.clientX, y: ev.clientY };
        imgSvc.startRectPos = { x_center: rect.x_center, y_center: rect.y_center, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }

      if (ev.type === 'mousemove') {
        if (!imgSvc.isDragging) return;
        this.dragRect(ev);
      }

      if (ev.type === 'mouseup') {
        if (!imgSvc.isDragging) return;
        imgSvc.isDragging = false;
        imgSvc.startRectPos = { x_center: -1, y_center: -1, left: -1, right: -1, top: -1, bottom: -1 };
        
        if (!imgSvc.currentRects.find(r => r.edited)) return;
        imgSvc.wasEdited = true;
        imgSvc.updateMainImageItemAndImages();
      }
    }

    // Drag edge

    // Drag corner

    // Rotate
  }

  private dragRect(e: MouseEvent): void {    
    const imgSvc = this.imagesService;
    if (!imgSvc.selectedRect) return;

    const { width, height } = imgSvc.c;
    // this.shouldUpdateCroppedImages = true;

    // Normalized deltas
    const dx = (e.clientX - imgSvc.mouseDownCurPos.x) / width;
    const dy = (e.clientY - imgSvc.mouseDownCurPos.y) / height;

    const start = imgSvc.startRectPos;
    const rect = imgSvc.selectedRect;

    // Compute proposed new position
    let newCx = start.x_center + dx;
    let newCy = start.y_center + dy;
    let newLeft = start.left + dx;
    let newRight = start.right + dx;
    let newTop = start.top + dy;
    let newBottom = start.bottom + dy;

    // Adjust so all corners stay within [0,1]
    if (newLeft < 0) {
      newCx += -newLeft;
      newLeft = 0;
      newRight = rect.width;
    }
    if (newRight > 1) {
      newCx -= newRight - 1;
      newRight = 1;
      newLeft = 1 - rect.width;
    }
    if (newTop < 0) {
      newCy += -newTop;
      newTop = 0;
      newBottom = rect.height;
    }
    if (newBottom > 1) {
      newCy -= newBottom - 1;
      newBottom = 1;
      newTop = 1 - rect.height;
    }

    // Build updated rect
    const updatedRect: Rect = {
      ...rect,
      x_center: newCx,
      y_center: newCy,
      left: newLeft,
      right: newRight,
      top: newTop,
      bottom: newBottom,
      edited: true
    };

    // Update state
    imgSvc.selectedRect = updatedRect;
    imgSvc.lastSelectedRect = updatedRect;
    imgSvc.currentRects = imgSvc.currentRects.map(r =>
      r.id === updatedRect.id ? updatedRect : r
    );

    // Redraw
    imgSvc.redrawImage();
    imgSvc.currentRects.forEach(r => imgSvc.drawRect(imgSvc.c, imgSvc.ctx, r));
  }
}
