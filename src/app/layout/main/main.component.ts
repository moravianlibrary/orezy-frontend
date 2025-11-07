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
    // Set canvas
    this.imagesService.c = document.getElementById('main-canvas') as HTMLCanvasElement;
    this.imagesService.ctx = this.imagesService.c.getContext('2d')!;
    
    // Set main image for full mode
    if (this.imagesService.mode() === 'full') {
      const [firstFlagged] = this.imagesService.flaggedImages();
      if (firstFlagged) this.imagesService.setMainImage(firstFlagged);
    }

    // Attach event handlers
    this.attachMainImageEvents();
    this.attachMainCanvasEvents();
    ['#main-container', 'app-left-panel' , 'app-bottom-panel', 'app-right-panel'].forEach(el => this.attachEventsRest(document.querySelector(el)));
  }

  private attachEventsRest(el: HTMLElement | null): void {
    if (!el) return;

    el.onclick = (ev) => {
      const tagName = (ev.target as HTMLElement).tagName;
      if (tagName === 'APP-RIGHT-PANEL') return;
      if (tagName !== 'APP-LEFT-PANEL' && tagName !== 'DIV' && tagName !== 'APP-RIGHT-PANEL' && tagName !== 'APP-BOTTOM-PANEL') return;
      if (el.tagName === 'DIV' && tagName !== 'DIV') return;
      if (this.imagesService.mode() === 'single' || !this.imagesService.selectedRect) return;
      this.imagesService.selectedRect = null;
      this.imagesService.lastRectCursorIsInside = null;
      this.imagesService.editable.set(false);
      this.imagesService.toggleMainImageOrCanvas();
      this.hoveringRect('');
      this.imagesService.updateMainImageItemAndImages();
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
    const mainElement = document.getElementById(this.imagesService.editable() ? 'main-canvas' : 'main-image') as HTMLElement;
    if (!mainElement) return '';

    const rect = mainElement.getBoundingClientRect();
    const [x, y] = [e.clientX - rect.left, e.clientY - rect.top];

    const hit = this.imagesService.selectedRect && this.imagesService.currentRects.filter(r => this.isPointInRect(x, y, r)).includes(this.imagesService.selectedRect)
      ? this.imagesService.selectedRect
      : this.imagesService.currentRects.find(r => this.isPointInRect(x, y, r));
    
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
    this.imagesService.redrawImage();
    this.imagesService.currentRects.forEach(r => this.imagesService.drawRect(this.imagesService.c, this.imagesService.ctx, r, hoveredRectId));
  }

  private handleCanvasInteraction(ev: MouseEvent, el: HTMLElement): void {
    if ((ev.target as HTMLElement).tagName !== 'CANVAS') return;
    
    const rectId = this.rectIdCursorInside(ev);
    const insideRect = Boolean(rectId);

    if (ev.type === 'mousedown') {
      this.imagesService.selectedRect = this.imagesService.currentRects.find(r => r.id === rectId) || null;
      this.imagesService.lastRectCursorIsInside = this.imagesService.currentRects.find(r => r.id === rectId) ?? null;
      this.imagesService.editable.set(insideRect);
      this.imagesService.toggleMainImageOrCanvas();
      this.hoveringRect(rectId);
      this.imagesService.updateMainImageItemAndImages();
    }

    if (ev.type === 'mousemove') {
      if (this.imagesService.lastRectCursorIsInside?.id === rectId && !this.imagesService.selectedRect) return;
      if (!this.imagesService.isDragging) {
        this.imagesService.lastRectCursorIsInside = this.imagesService.currentRects.find(r => r.id === rectId) ?? null;
        this.imagesService.editable.set(insideRect);
        this.imagesService.toggleMainImageOrCanvas();
        this.hoveringRect(rectId);
      }
    }

    // Drag rect
    el.style.cursor = insideRect ? 'move' : 'initial';
    if (insideRect) {
      if (ev.type === 'mousedown') {
        const rect = this.imagesService.selectedRect;
        if (!rect) return;

        this.imagesService.isDragging = true;
        this.imagesService.mouseDownCurPos = { x: ev.clientX, y: ev.clientY };
        this.imagesService.startRectPos = { x: rect?.x_center, y: rect?.y_center };
      }

      if (ev.type === 'mousemove') {
        if (!this.imagesService.isDragging) return;
        this.dragRect(ev);
      }

      if (ev.type === 'mouseup') {
        if (!this.imagesService.isDragging) return;
        this.imagesService.isDragging = false;
        this.imagesService.startRectPos = { x: -1, y: -1 };
        
        if (!this.imagesService.currentRects.find(r => r.edited)) return;
        this.imagesService.wasEdited = true;
        this.imagesService.updateMainImageItemAndImages();
      }
    }

    // Drag edge

    // Drag corner

    // Rotate
  }

  private dragRect(e: MouseEvent): void {    
    if (!this.imagesService.selectedRect) return;

    const { width, height } = this.imagesService.c;
    // this.shouldUpdateCroppedImages = true;

    // Normalized deltas
    const dx = (e.clientX - this.imagesService.mouseDownCurPos.x) / width;
    const dy = (e.clientY - this.imagesService.mouseDownCurPos.y) / height;

    const start = this.imagesService.startRectPos;
    const rect = this.imagesService.selectedRect;
    const angle = degreeToRadian(-rect.angle);

    // Compute proposed new position
    let newCx = start.x + dx;
    let newCy = start.y + dy;

    // Clamp position so the rectangle stays within img
    const hw = rect.width / 2;
    const hh = rect.height / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Corners relative to center
    const rel = [
      { x: -hw, y: -hh },
      { x:  hw, y: -hh },
      { x:  hw, y:  hh },
      { x: -hw, y:  hh },
    ];

    // Compute rotated corner positions
    const corners = rel.map(p => ({
      x: newCx + p.x * cos - p.y * sin,
      y: newCy + p.x * sin + p.y * cos
    }));

    // Find overflows
    const minX = Math.min(...corners.map(p => p.x));
    const maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y));
    const maxY = Math.max(...corners.map(p => p.y));

    // Adjust so all corners stay within [0,1]
    if (minX < 0) newCx += -minX;
    if (maxX > 1) newCx -= maxX - 1;
    if (minY < 0) newCy += -minY;
    if (maxY > 1) newCy -= maxY - 1;
    // -----------------------------------

    // Build updated rect
    const updatedRect = {
      ...rect,
      x_center: newCx,
      y_center: newCy,
      x: Number((newCx - rect.width / 2).toFixed(4)),
      y: Number((newCy - rect.height / 2).toFixed(4)),
      width: Number(rect.width.toFixed(4)),
      height: Number(rect.height.toFixed(4)),
      edited: true
    };

    // newCx = Math.min(Math.max(newCx, hw), 1 - hw);
    // newCy = Math.min(Math.max(newCy, hh), 1 - hh);

    // // Create updated rect
    // const updatedRect = {
    //   ...this.selectedRect,
    //   x_center: newCx,
    //   y_center: newCy,
    //   x: newCx - this.selectedRect.width / 2,
    //   y: newCy - this.selectedRect.height / 2,
    //   edited: true
    // };

    // Update state
    this.imagesService.selectedRect = updatedRect;
    this.imagesService.lastSelectedRect = updatedRect;
    this.imagesService.currentRects = this.imagesService.currentRects.map(r =>
      r.id === updatedRect.id ? updatedRect : r
    );

    // Redraw
    this.imagesService.redrawImage();
    this.imagesService.currentRects.forEach(r => this.imagesService.drawRect(this.imagesService.c, this.imagesService.ctx, r));
  }
}
