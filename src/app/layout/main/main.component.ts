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
    this.attachImageEvents('main-container');
    this.attachImageEvents('main-image');
    this.attachImageEvents('main-canvas');
  }

  private attachImageEvents(elementId: string): void {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.onclick = (ev) => this.handleInteraction(ev, el);
    el.onmousedown = (ev) => this.handleInteraction(ev, el);
    el.onmousemove = (ev) => this.handleInteraction(ev, el);
    el.onmouseup = (ev) => this.handleInteraction(ev, el);
  }

  private handleInteraction(ev: MouseEvent, el: HTMLElement): void {
    const rectId = this.imagesService.rectIdCursorInside(ev);
    const insideRect = Boolean(rectId);

    if (ev.type === 'mousemove' || ev.type === 'click') {
      const { lastRectCursorIsInside, selectedRect } = this.imagesService;
      const sameState = lastRectCursorIsInside === insideRect && (ev.type === 'click' ? selectedRect?.id === rectId : false);
      if (sameState) return;
    }

    if (ev.type === 'mousedown') {
      this.imagesService.selectedRect = this.imagesService.currentRects.find(r => r.id === rectId) || null;

      if (!this.imagesService.selectedRect && this.imagesService.startRectPos.x === -1) {
        this.imagesService.updateMainImageItemAndImages();
      }
    }

    this.imagesService.lastRectCursorIsInside = insideRect;
    this.imagesService.editable.set(insideRect);
    this.imagesService.toggleMainImageOrCanvas();
    this.imagesService.hoveringRect(rectId);

    if (el.tagName !== 'CANVAS') return;
    el.style.cursor = insideRect ? 'move' : 'initial';

    // Drag rect
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
        this.imagesService.isDragging = false;
        this.imagesService.startRectPos = { x: -1, y: -1 };
        this.imagesService.updateMainImageItemAndImages();
      }
    }

    // Drag edge

    // Drag corner

    // Rotate
  }
}
