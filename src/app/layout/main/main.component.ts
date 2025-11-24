import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { degreeToRadian } from '../../utils/utils';
import { CornerName, EdgeLocalOrientation, HitInfo, Page } from '../../app.types';
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
  private rotateCursorTopRight: string = "url('/assets/rotate-cursor-top-right.png'), auto";
  private rotateCursorTopLeft: string = "url('/assets/rotate-cursor-top-left.png'), auto";
  private rotateCursorBottomRight: string = "url('/assets/rotate-cursor-bottom-right.png'), auto";
  private rotateCursorBottomLeft: string = "url('/assets/rotate-cursor-bototm-left.png'), auto";

  private edgeHitTolerance = 14;
  private cornerHitTolerance = 14;
  private rotateHandleOffset = 14;
  private rotateHitTolerance = 24;

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
      if (imgSvc.dialogOpened) {
        imgSvc.dialogOpened = false;
        return;
      }
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
    const pos = this.getMousePosOnMain(e);
    if (!pos) return '';

    const hit = imgSvc.selectedPage && imgSvc.currentPages.filter(p => this.isPointInPage(pos.x, pos.y, p)).includes(imgSvc.selectedPage)
      ? imgSvc.selectedPage
      : imgSvc.currentPages.find(p => this.isPointInPage(pos.x, pos.y, p));
    
    return hit?._id ?? '';
  }

  private isPointInPage(x: number, y: number, p: Page): boolean {
    const c = this.imagesService.c;
    const [centerX, centerY] = [c.width * p.xc, c.height * p.yc];
    const [width, height] = [c.width * p.width, c.height * p.height];
    const angle = degreeToRadian(p.angle);
    const [halfW, halfH] = [width / 2, height / 2];
    const dx = x - centerX;
    const dy = y - centerY;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    return localX >= -halfW && localX <= halfW && localY >= -halfH && localY <= halfH;
  }

  private hitTest(e: MouseEvent): HitInfo {
    const pos = this.getMousePosOnMain(e);
    if (!pos) return { area: 'none' };

    const imgSvc = this.imagesService;
    const pages = imgSvc.currentPages;

    if (imgSvc.selectedPage) {
      const hit = this.hitTestPage(pos.x, pos.y, imgSvc.selectedPage);
      if (hit.area !== 'none') return hit;
    }

    for (const p of pages) {
      if (p === imgSvc.selectedPage) continue;
      const hit = this.hitTestPage(pos.x, pos.y, p);
      if (hit.area !== 'none') return hit;
    }

    return { area: 'none' };
  }

  private getCornerCursor(angleDeg: number, corner: CornerName): string {
    let a = angleDeg % 180;
    if (a < 0) a += 180;

    const baseForCorner =
      corner === 'nw' || corner === 'se'
        ? 'nwse-resize'
        : 'nesw-resize';

    const flippedForCorner =
      baseForCorner === 'nwse-resize' ? 'nesw-resize' : 'nwse-resize';

    const flip = a >= 45 && a <= 135;
    return flip ? flippedForCorner : baseForCorner;
  }

  private getEdgeCursor(angleDeg: number, local: EdgeLocalOrientation): string {
    let a = angleDeg % 180;
    if (a < 0) a += 180;

    const mostlyHorizontal = a < 45 || a > 135;

    if (local === 'vertical') {
      return mostlyHorizontal ? 'ew-resize' : 'ns-resize';
    } else {
      return mostlyHorizontal ? 'ns-resize' : 'ew-resize';
    }
  }

  private hitTestPage(x: number, y: number, p: Page): HitInfo {
    const imgSvc = this.imagesService;
    const c = imgSvc.c;
    const [centerX, centerY] = [c.width * p.xc, c.height * p.yc];
    const [width, height] = [c.width * p.width, c.height * p.height];
    const angle = degreeToRadian(p.angle);

    const hw = width / 2;
    const hh = height / 2;

    const dx = x - centerX;
    const dy = y - centerY;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const withinXWithTolerance = Math.abs(localX) <= hw + this.edgeHitTolerance / 2;
    const withinYWithTolerance = Math.abs(localY) <= hh + this.edgeHitTolerance / 2;
    const withinX = Math.abs(localX) <= hw;
    const withinY = Math.abs(localY) <= hh;

    // Corners and rotates
    const corners: { x: number; y: number; name: CornerName }[] = [
      { x: -hw - imgSvc.cornerSize / 2, y: -hh - imgSvc.cornerSize / 2, name: 'nw' },
      { x: hw + imgSvc.cornerSize / 2,  y: -hh - imgSvc.cornerSize / 2, name: 'ne' },
      { x: hw + imgSvc.cornerSize / 2,  y: hh + imgSvc.cornerSize / 2,  name: 'se' },
      { x: -hw - imgSvc.cornerSize / 2, y: hh + imgSvc.cornerSize / 2,  name: 'sw' }
    ];

    for (const corner of corners) {
      const dxC = localX - corner.x;
      const dyC = localY - corner.y;
      const distCorner = Math.hypot(dxC, dyC);

      if (distCorner <= this.cornerHitTolerance) {
        return { area: 'corner', page: p, corner: corner.name };
      }

      const distToCorner = Math.hypot(localX - corner.x, localY - corner.y);
      if (
        distToCorner < this.rotateHandleOffset
        || distToCorner > this.rotateHitTolerance
        || (withinX && withinY)
      ) {
        continue;
      }

      return { area: 'rotate', page: p, corner: corner.name };
    }

    if (!withinXWithTolerance || !withinYWithTolerance) {
      return { area: 'none' };
    }

    // Edge detection in local space
    const nearLeftOrRight = Math.abs(Math.abs(localX) - (hw + 6)) <= this.edgeHitTolerance;
    const nearTopOrBottom = Math.abs(Math.abs(localY) - (hh + 6)) <= this.edgeHitTolerance;

    if (nearLeftOrRight && !nearTopOrBottom) {
      return { area: 'edge', page: p, edgeOrientation: 'vertical' };
    }

    if (nearTopOrBottom && !nearLeftOrRight) {
      return { area: 'edge', page: p, edgeOrientation: 'horizontal' };
    }

    if (withinX && withinY) {
      return { area: 'inside', page: p };
    }

    return { area: 'none' };
  }

  private getMousePosOnMain(e: MouseEvent): { x: number; y: number } | null {
    const mainElement = document.getElementById(this.imagesService.editable() ? 'main-canvas' : 'main-image') as HTMLElement;
    if (!mainElement) return null;

    const rect = mainElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  private hoveringPage(hoveredPageId: string): void {
    const imgSvc = this.imagesService;
    imgSvc.redrawImage();
    imgSvc.currentPages.forEach(p => imgSvc.drawPage(p, hoveredPageId));
  }

  private handleCanvasInteraction(ev: MouseEvent, el: HTMLElement): void {
    if ((ev.target as HTMLElement).tagName !== 'CANVAS') return;
    const imgSvc = this.imagesService;
    
    const hit = this.hitTest(ev);
    const insidePage = hit.area !== 'none';
    const hitPage = hit.page ?? null;

    if (ev.type === 'mousedown') {
      if (imgSvc.pageWasEdited) {
        imgSvc.updateCurrentPagesWithEdited();
      }
      imgSvc.selectedPage = hitPage;
      imgSvc.lastPageCursorIsInside = hitPage;
      imgSvc.editable.set(insidePage);
      imgSvc.toggleMainImageOrCanvas();
      this.hoveringPage(hitPage?._id ?? '');
      imgSvc.updateMainImageItemAndImages();
    }

    if (ev.type === 'mousemove') {
      if (imgSvc.lastPageCursorIsInside?._id === hitPage?._id && !imgSvc.selectedPage) return;
      if (!imgSvc.isDragging) {
        imgSvc.lastPageCursorIsInside = hitPage;
        imgSvc.editable.set(insidePage);
        imgSvc.toggleMainImageOrCanvas();
        this.hoveringPage(hitPage?._id ?? '');
      }
    }

    let cursor = insidePage ? (imgSvc.selectedPage?._id === hitPage?._id ? this.moveCursor : 'pointer') : 'initial';

    if (hitPage === imgSvc.selectedPage) {
      if (hit.area === 'inside') {
        cursor = hitPage && imgSvc.selectedPage?._id === hitPage._id
          ? this.moveCursor
          : 'pointer';
      } else if (hit.area === 'edge' && hit.edgeOrientation && hitPage) {
        cursor = this.getEdgeCursor(hitPage.angle, hit.edgeOrientation);
      } else if (hit.area === 'corner' && hit.corner && hitPage) {
        cursor = this.getCornerCursor(hitPage.angle, hit.corner);
      } else if (hit.area === 'rotate') {
        console.log(hit.corner);
        if (hit.corner === 'ne') cursor = this.rotateCursorTopRight;
        if (hit.corner === 'nw') cursor = this.rotateCursorTopLeft;
        if (hit.corner === 'se') cursor = this.rotateCursorBottomRight;
        if (hit.corner === 'sw') cursor = this.rotateCursorBottomLeft;
      }
    }

    el.style.cursor = cursor;

    // Drag
    if (hit.area === 'inside' && hitPage) {
      if (ev.type === 'mousedown') {
        imgSvc.isDragging = true;
        imgSvc.mouseDownCurPos = { x: ev.clientX, y: ev.clientY };
        imgSvc.startPagePos = {
          xc: hitPage.xc,
          yc: hitPage.yc,
          left: hitPage.left,
          right: hitPage.right,
          top: hitPage.top,
          bottom: hitPage.bottom
        };
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
        imgSvc.isDragging = false;
        imgSvc.startPagePos = { xc: -1, yc: -1, left: -1, right: -1, top: -1, bottom: -1 };

        if (!imgSvc.imgWasEdited) return;
        this.hoveringPage(hitPage._id);
        imgSvc.updateMainImageItemAndImages();
      }
    }

    // Rotate

    // const pageId = this.pageIdCursorInside(ev);
    // const insidePage = Boolean(pageId);

    // if (ev.type === 'mousedown') {
    //   const potentialSelectedPage = imgSvc.currentPages.find(p => p._id === pageId);
    //   if (imgSvc.pageWasEdited) {
    //     imgSvc.updateCurrentPagesWithEdited();
    //   }
    //   imgSvc.selectedPage = potentialSelectedPage ?? null;
    //   imgSvc.lastPageCursorIsInside = potentialSelectedPage ?? null;
    //   imgSvc.editable.set(insidePage);
    //   imgSvc.toggleMainImageOrCanvas();
    //   this.hoveringPage(pageId);
    //   imgSvc.updateMainImageItemAndImages();
    // }

    // if (ev.type === 'mousemove') {
    //   if (imgSvc.lastPageCursorIsInside?._id === pageId && !imgSvc.selectedPage) return;
    //   if (!imgSvc.isDragging) {
    //     imgSvc.lastPageCursorIsInside = imgSvc.currentPages.find(p => p._id === pageId) ?? null;
    //     imgSvc.editable.set(insidePage);
    //     imgSvc.toggleMainImageOrCanvas();
    //     this.hoveringPage(pageId);
    //   }
    // }

    // Drag page
    // el.style.cursor = insidePage ? (imgSvc.selectedPage?._id === pageId ? this.moveCursor : 'pointer') : 'initial';
    // if (insidePage) {
    //   if (ev.type === 'mousedown') {
    //     const page = imgSvc.selectedPage;
    //     if (!page) return;

    //     imgSvc.isDragging = true;
    //     imgSvc.mouseDownCurPos = { x: ev.clientX, y: ev.clientY };
    //     imgSvc.startPagePos = { xc: page.xc, yc: page.yc, left: page.left, right: page.right, top: page.top, bottom: page.bottom };
    //   }

    //   if (ev.type === 'mousemove') {
    //     if (!imgSvc.isDragging) return;
    //     el.style.cursor = this.moveCursor;
    //     imgSvc.pageWasEdited = true;
    //     imgSvc.imgWasEdited = true;
    //     this.dragPage(ev);
    //   }

    //   if (ev.type === 'mouseup') {
    //     if (!imgSvc.isDragging) return;
    //     el.style.cursor = insidePage ? (imgSvc.selectedPage?._id === pageId ? this.moveCursor : 'pointer') : 'initial';
    //     imgSvc.isDragging = false;
    //     imgSvc.startPagePos = { xc: -1, yc: -1, left: -1, right: -1, top: -1, bottom: -1 };
        
    //     if (!imgSvc.imgWasEdited) return;
    //     this.hoveringPage(pageId);
    //     imgSvc.updateMainImageItemAndImages();
    //   }
    // }
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
