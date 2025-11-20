import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { degreeToRadian } from '../../utils/utils';
import { Page } from '../../app.types';
import { LoaderComponent } from '../../components/loader/loader.component';

@Component({
  selector: 'app-main',
  imports: [LoaderComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  imagesService = inject(ImagesService);
  private moveCursor: string = "url('/assets/move-cursor.png'), auto";

  ngAfterViewInit(): void {
    const imgSvc = this.imagesService;
    
    // Set canvas
    imgSvc.c = document.getElementById('main-canvas') as HTMLCanvasElement;
    imgSvc.ctx = imgSvc.c.getContext('2d')!;

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
      if (!imgSvc.selectedPage) return;
      if (imgSvc.pageWasEdited) imgSvc.updateCurrentPagesWithEdited();
      imgSvc.selectedPage = null;
      imgSvc.lastPageCursorIsInside = null;
      imgSvc.editable.set(false);
      imgSvc.toggleMainImageOrCanvas();
      this.hoveringPage('');
      imgSvc.updateMainImageItemAndImages();
    };

    el.onmousemove = (ev) => {
      if (el.tagName === 'DIV' && (ev.target as HTMLElement).tagName !== 'DIV') return;
      const pageId = this.pageIdCursorInside(ev);
      const insidePage = Boolean(pageId);
      this.imagesService.editable.set(insidePage);
      this.imagesService.toggleMainImageOrCanvas();
    };
  }

  private attachMainImageEvents(): void {
    const el = document.getElementById('main-image');
    if (!el) return;

    el.onmousemove = (ev) => {
      if ((ev.target as HTMLElement).tagName !== 'IMG') return;
      const pageId = this.pageIdCursorInside(ev);
      const insidePage = Boolean(pageId);
      this.imagesService.editable.set(insidePage);
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

  // ---------- PAGE LOGIC ----------
  private pageIdCursorInside(e: MouseEvent): string {
    const imgSvc = this.imagesService;
    const mainElement = document.getElementById(imgSvc.editable() ? 'main-canvas' : 'main-image') as HTMLElement;
    if (!mainElement) return '';

    const page = mainElement.getBoundingClientRect();
    const [x, y] = [e.clientX - page.left, e.clientY - page.top];

    const hit = imgSvc.selectedPage && imgSvc.currentPages.filter(p => this.isPointInPage(x, y, p)).includes(imgSvc.selectedPage)
      ? imgSvc.selectedPage
      : imgSvc.currentPages.find(p => this.isPointInPage(x, y, p));
    
    return hit?._id ?? '';
  }

  private isPointInPage(x: number, y: number, r: Page): boolean {
    const c = this.imagesService.c;
    const [centerX, centerY] = [c.width * r.xc, c.height * r.yc];
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

  private hoveringPage(hoveredPageId: string): void {
    const imgSvc = this.imagesService;
    imgSvc.redrawImage();
    imgSvc.currentPages.forEach(p => imgSvc.drawPage(p, hoveredPageId));
  }

  private handleCanvasInteraction(ev: MouseEvent, el: HTMLElement): void {
    if ((ev.target as HTMLElement).tagName !== 'CANVAS') return;
    const imgSvc = this.imagesService;
    const pageId = this.pageIdCursorInside(ev);
    const insidePage = Boolean(pageId);

    if (ev.type === 'mousedown') {
      const potentialSelectedPage = imgSvc.currentPages.find(p => p._id === pageId);
      if (imgSvc.pageWasEdited && potentialSelectedPage === undefined) {
        imgSvc.updateCurrentPagesWithEdited();
      }
      imgSvc.selectedPage = potentialSelectedPage || null;
      imgSvc.lastPageCursorIsInside = imgSvc.currentPages.find(p => p._id === pageId) ?? null;
      imgSvc.editable.set(insidePage);
      imgSvc.toggleMainImageOrCanvas();
      this.hoveringPage(pageId);
      imgSvc.updateMainImageItemAndImages();
    }

    if (ev.type === 'mousemove') {
      if (imgSvc.lastPageCursorIsInside?._id === pageId && !imgSvc.selectedPage) return;
      if (!imgSvc.isDragging) {
        imgSvc.lastPageCursorIsInside = imgSvc.currentPages.find(p => p._id === pageId) ?? null;
        imgSvc.editable.set(insidePage);
        imgSvc.toggleMainImageOrCanvas();
        this.hoveringPage(pageId);
      }
    }

    // Drag page
    el.style.cursor = insidePage ? (imgSvc.selectedPage?._id === pageId ? this.moveCursor : 'pointer') : 'initial';
    if (insidePage) {
      if (ev.type === 'mousedown') {
        const page = imgSvc.selectedPage;
        if (!page) return;

        imgSvc.isDragging = true;
        imgSvc.mouseDownCurPos = { x: ev.clientX, y: ev.clientY };
        imgSvc.startPagePos = { xc: page.xc, yc: page.yc, left: page.left, right: page.right, top: page.top, bottom: page.bottom };
      }

      if (ev.type === 'mousemove') {
        if (!imgSvc.isDragging) return;
        el.style.cursor = this.moveCursor;
        imgSvc.pageWasEdited = true;
        imgSvc.imgWasEdited = true;
        this.dragPage(ev);
      }

      if (ev.type === 'mouseup') {
        if (!imgSvc.isDragging) return;
        el.style.cursor = insidePage ? (imgSvc.selectedPage?._id === pageId ? this.moveCursor : 'pointer') : 'initial';
        imgSvc.isDragging = false;
        imgSvc.startPagePos = { xc: -1, yc: -1, left: -1, right: -1, top: -1, bottom: -1 };
        
        if (!imgSvc.imgWasEdited) return;
        imgSvc.updateMainImageItemAndImages();
      }
    }

    // Drag edge

    // Drag corner

    // Rotate
  }

  private dragPage(e: MouseEvent): void {    
    const imgSvc = this.imagesService;
    if (!imgSvc.selectedPage) return;

    const { width, height } = imgSvc.c;
    const start = imgSvc.startPagePos;
    const page = imgSvc.selectedPage;

    // Normalized deltas
    const dx = (e.clientX - imgSvc.mouseDownCurPos.x) / width;
    const dy = (e.clientY - imgSvc.mouseDownCurPos.y) / height;

    // Compute proposed new position
    let newCx = start.xc + dx;
    let newCy = start.yc + dy;
    let newLeft = start.left + dx;
    let newRight = start.right + dx;
    let newTop = start.top + dy;
    let newBottom = start.bottom + dy;

    // Adjust so all corners stay within [0,1]
    if (newLeft < 0) {
      newCx += -newLeft;
      newRight += -newLeft;
      newLeft = 0;
    }
    if (newRight > 1) {
      newCx -= newRight - 1;
      newLeft -= newRight - 1;
      newRight = 1;
    }
    if (newTop < 0) {
      newCy += -newTop;
      newBottom += -newTop;
      newTop = 0;
    }
    if (newBottom > 1) {
      newCy -= newBottom - 1;
      newTop -= newBottom - 1;
      newBottom = 1;
    }

    // Build updated page
    const updatedPage: Page = {
      ...page,
      xc: newCx,
      yc: newCy,
      left: newLeft,
      right: newRight,
      top: newTop,
      bottom: newBottom,
    };

    // Update state
    imgSvc.selectedPage = updatedPage;
    imgSvc.lastSelectedPage = updatedPage;
    imgSvc.currentPages = imgSvc.currentPages.map(p =>
      p._id === updatedPage._id ? updatedPage : p
    );

    // Redraw
    imgSvc.redrawImage();
    imgSvc.currentPages.forEach(p => imgSvc.drawPage(p));
  }
}
