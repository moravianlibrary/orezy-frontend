import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImagesService } from '../../services/images.service';
import { ButtonGroupComponent } from '../../components/button-group/button-group.component';

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
    ['#main-container', 'app-preview-panel'/* , 'app-properties-panel' */].forEach(el => this.attachEventsRest(document.querySelector(el)));
  }

  private attachEventsRest(el: HTMLElement | null): void {
    if (!el) return;

    el.onclick = (ev) => {
      const tagName = (ev.target as HTMLElement).tagName;
      if (tagName !== 'APP-PREVIEW-PANEL' && tagName !== 'DIV' && tagName !== 'APP-PROPERTIES-PANEL') return;
      if (el.tagName === 'DIV' && tagName !== 'DIV') return;
      if (this.imagesService.mode() === 'single' || !this.imagesService.selectedRect) return;
      this.imagesService.selectedRect = null;
      this.imagesService.lastRectCursorIsInside = null;
      this.imagesService.editable.set(false);
      this.imagesService.toggleMainImageOrCanvas();
      this.imagesService.hoveringRect('');
      this.imagesService.updateMainImageItemAndImages();
    };

    el.onmousemove = (ev) => {
      if (el.tagName === 'DIV' && (ev.target as HTMLElement).tagName !== 'DIV') return;
      const rectId = this.imagesService.rectIdCursorInside(ev);
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
      const rectId = this.imagesService.rectIdCursorInside(ev);
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

  private handleCanvasInteraction(ev: MouseEvent, el: HTMLElement): void {
    if ((ev.target as HTMLElement).tagName !== 'CANVAS') return;
    
    const rectId = this.imagesService.rectIdCursorInside(ev);
    const insideRect = Boolean(rectId);

    if (ev.type === 'mousedown') {
      this.imagesService.selectedRect = this.imagesService.currentRects.find(r => r.id === rectId) || null;
      this.imagesService.lastRectCursorIsInside = this.imagesService.currentRects.find(r => r.id === rectId) ?? null;
      this.imagesService.editable.set(insideRect);
      this.imagesService.toggleMainImageOrCanvas();
      this.imagesService.hoveringRect(rectId);
      this.imagesService.updateMainImageItemAndImages();
    }

    if (ev.type === 'mousemove') {
      if (this.imagesService.lastRectCursorIsInside?.id === rectId && !this.imagesService.selectedRect) return;
      if (!this.imagesService.isDragging) {
        this.imagesService.lastRectCursorIsInside = this.imagesService.currentRects.find(r => r.id === rectId) ?? null;
        this.imagesService.editable.set(insideRect);
        this.imagesService.toggleMainImageOrCanvas();
        this.imagesService.hoveringRect(rectId);
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
        this.imagesService.dragRect(ev);
      }

      if (ev.type === 'mouseup') {
        if (!this.imagesService.isDragging) return;
        this.imagesService.isDragging = false;
        this.imagesService.startRectPos = { x: -1, y: -1 };
        
        if (!this.imagesService.currentRects.find(r => r.edited)) return;
        this.imagesService.updateMainImageItemAndImages();
      }
    }

    // Drag edge

    // Drag corner

    // Rotate
  }
}
