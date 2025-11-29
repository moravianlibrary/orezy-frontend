import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { degreeToRadian, radianToDegree } from '../../utils/utils';
import { CornerName, EdgeLocalOrientation, EdgeSide, HitInfo, Page } from '../../app.types';
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
      if (tagName === 'APP-RIGHT-PANEL' || el.tagName === 'APP-RIGHT-PANEL') return;
      if (tagName !== 'APP-LEFT-PANEL' && tagName !== 'DIV' && tagName !== 'APP-RIGHT-PANEL' && tagName !== 'APP-BOTTOM-PANEL') return;
      if (el.tagName === 'DIV' && tagName !== 'DIV') return;
      if (!imgSvc.selectedPage) return;
      if (imgSvc.dialogOpened) {
        imgSvc.dialogOpened = false;
        return;
      }
      if (imgSvc.isDragging || imgSvc.isRotating || imgSvc.isResizing) {
        imgSvc.isDragging = false;
        imgSvc.dragStartPage = null;
        imgSvc.dragStartMouse = null;
        
        imgSvc.isRotating = false;
        imgSvc.rotationStartPage = null;
        imgSvc.rotationStartMouseAngle = 0;
      
        imgSvc.isResizing = false;
        imgSvc.resizeStartPage = null;
        imgSvc.resizeStartMouse = null;
        imgSvc.resizeMode = null;
        
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

  private localEdgeSideToUserSide(localSide: 'left' | 'right' | 'top' | 'bottom', angleDeg: number) {
    const a = angleDeg;

    if (a >= -45 && a <= 45) {
      return localSide;
    }

    if (a > 45 && a <= 135) {
      switch (localSide) {
        case 'left': return 'top';
        case 'right': return 'bottom';
        case 'top': return 'right';
        case 'bottom': return 'left';
      }
    }

    if (a > 135 || a <= -135) {
      switch (localSide) {
        case 'left': return 'right';
        case 'right': return 'left';
        case 'top': return 'bottom';
        case 'bottom': return 'top';
      }
    }

    if (a > -135 && a < -45) {
      switch (localSide) {
        case 'left': return 'bottom';
        case 'right': return 'top';
        case 'top': return 'left';
        case 'bottom': return 'right';
      }
    }

    return localSide;
  }

  private localCornerToUserCorner(local: CornerName, angleDeg: number): CornerName {
    const a = angleDeg;

    if (a >= -45 && a <= 45) return local;

    if (a > 45 && a <= 135) {
      const map90: { [key: string]: CornerName } = { nw: 'ne', ne: 'se', se: 'sw', sw: 'nw' };
      return map90[local];
    }

    if (a > 135 || a <= -135) {
      const map180: { [key: string]: CornerName } = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
      return map180[local];
    }

    const map270: { [key: string]: CornerName } = { nw: 'sw', sw: 'se', se: 'ne', ne: 'nw' };
    return map270[local];
  }

  private getEdgeCursor(angleDeg: number, local: EdgeLocalOrientation): string {
    let a = angleDeg % 180;
    if (a < 0) a += 180;

    const mostlyHorizontal = a <= 45 || a >= 135;

    if (local === 'vertical') {
      return mostlyHorizontal ? 'ew-resize' : 'ns-resize';
    } else {
      return mostlyHorizontal ? 'ns-resize' : 'ew-resize';
    }
  }

  private getCornerCursor(angleDeg: number, corner: CornerName): string {
    let a = angleDeg % 180;
    if (a < 0) a += 180;

    const userCorner = this.localCornerToUserCorner(corner, angleDeg);

    const baseForCorner =
      userCorner === 'nw' || userCorner === 'se'
        ? 'nwse-resize'
        : 'nesw-resize';

    const flippedForCorner =
      baseForCorner === 'nwse-resize' ? 'nesw-resize' : 'nwse-resize';

    const flip = a >= 45 && a <= 135;
    return flip ? flippedForCorner : baseForCorner;
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

      // Corners
      if (distCorner <= this.cornerHitTolerance) {
        const userCorner = this.localCornerToUserCorner(corner.name, p.angle);
        return { area: 'corner', page: p, corner: userCorner };
      }

      const distToCorner = Math.hypot(localX - corner.x, localY - corner.y);
      if (
        distToCorner < this.rotateHandleOffset
        || distToCorner > this.rotateHitTolerance
        || (withinX && withinY)
      ) {
        continue;
      }

      // Rotates
      const userCorner = this.localCornerToUserCorner(corner.name, p.angle);
      return { area: 'rotate', page: p, corner: userCorner };
    }

    if (!withinXWithTolerance || !withinYWithTolerance) {
      return { area: 'none' };
    }

    // Edge detection in user space (not local)
    const nearLeftOrRight = Math.abs(Math.abs(localX) - (hw + 6)) <= this.edgeHitTolerance;
    const nearTopOrBottom = Math.abs(Math.abs(localY) - (hh + 6)) <= this.edgeHitTolerance;

    if (nearLeftOrRight && !nearTopOrBottom) {
      const localSide = localX > 0 ? 'right' : 'left';
      const userSide = this.localEdgeSideToUserSide(localSide, p.angle);
      return { area: 'edge', page: p, edgeOrientation: 'vertical', edgeSide: userSide };
      // const isRight = localX > 0;
      // return { area: 'edge', page: p, edgeOrientation: 'vertical', edgeSide: isRight ? 'right' : 'left' };
    }

    if (nearTopOrBottom && !nearLeftOrRight) {
      const localSide = localY > 0 ? 'bottom' : 'top';
      const userSide = this.localEdgeSideToUserSide(localSide, p.angle);
      return { area: 'edge', page: p, edgeOrientation: 'horizontal', edgeSide: userSide };
      // const isBottom = localY > 0;
      // return { area: 'edge', page: p, edgeOrientation: 'horizontal', edgeSide: isBottom ? 'bottom' : 'top' };
    }

    // Inside rect
    if (withinX && withinY) {
      return { area: 'inside', page: p };
    }

    // Else
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
    const pageId = this.pageIdCursorInside(ev);
    const insidePage = Boolean(pageId);
    const insideArea = hit.area !== 'none';
    const hitPage = hit.page ?? null;

    // Hover
    if (ev.type === 'mousemove') {
      if (imgSvc.lastPageCursorIsInside?._id === pageId && !imgSvc.selectedPage) return;
      if (!imgSvc.isDragging && !imgSvc.isRotating) {
        imgSvc.lastPageCursorIsInside = imgSvc.currentPages.find(p => p._id === pageId) ?? null;
        imgSvc.editable.set(insidePage);
        imgSvc.toggleMainImageOrCanvas();
        this.hoveringPage(hitPage?._id === imgSvc.selectedPage?._id ? imgSvc.selectedPage?._id ?? '' : pageId);
      }
    }

    // Change to correct cursor while having selected page
    let cursor = insidePage ? (imgSvc.selectedPage?._id === hitPage?._id ? this.moveCursor : 'pointer') : 'initial';
    if (hitPage && hitPage === imgSvc.selectedPage) {
      if (hit.area === 'inside') {
        cursor = hitPage && imgSvc.selectedPage?._id === hitPage._id
          ? this.moveCursor
          : 'pointer';
      } else if (hit.area === 'edge' && hit.edgeOrientation && hitPage) {
        cursor = this.getEdgeCursor(hitPage.angle, hit.edgeOrientation);
      } else if (hit.area === 'corner' && hit.corner && hitPage) {
        cursor = this.getCornerCursor(hitPage.angle, hit.corner);
      } else if (hit.area === 'rotate') {
        if (hit.corner === 'ne') cursor = this.rotateCursorTopRight;
        if (hit.corner === 'nw') cursor = this.rotateCursorTopLeft;
        if (hit.corner === 'se') cursor = this.rotateCursorBottomRight;
        if (hit.corner === 'sw') cursor = this.rotateCursorBottomLeft;
      }
    }
    el.style.cursor = cursor;

    // On mousedown
    if (ev.type === 'mousedown') {
      if (imgSvc.pageWasEdited && (cursor === 'initial' || cursor === 'pointer')) {
        imgSvc.updateCurrentPagesWithEdited();
      }
      imgSvc.lastSelectedPage = imgSvc.selectedPage;
      imgSvc.selectedPage = hitPage;
      imgSvc.clickedDiffPage = imgSvc.lastSelectedPage && imgSvc.selectedPage && imgSvc.lastSelectedPage !== imgSvc.selectedPage;
      imgSvc.lastPageCursorIsInside = hitPage;
      imgSvc.editable.set(insideArea);
      imgSvc.toggleMainImageOrCanvas();
      this.hoveringPage(hitPage?._id ?? '');
      imgSvc.updateMainImageItemAndImages();
    }    

    // Drag
    if (hit.area === 'inside' || imgSvc.isDragging) {
      if (ev.type === 'mousedown' && hitPage) {
        imgSvc.isDragging = true;
        imgSvc.dragStartMouse = { x: ev.clientX, y: ev.clientY };
        imgSvc.dragStartPage = structuredClone(hitPage);
      }

      if (imgSvc.isDragging) {
        if (ev.type === 'mousemove') {
          el.style.cursor = this.moveCursor;
          imgSvc.pageWasEdited = true;
          imgSvc.imgWasEdited = true;
          this.dragPage(ev);
        }

        if (ev.type === 'mouseup' && hitPage) {
          imgSvc.isDragging = false;
          imgSvc.dragStartPage = null;

          if (!imgSvc.imgWasEdited) return;
          this.hoveringPage(hitPage._id);
          imgSvc.updateMainImageItemAndImages();
        }
      }
    }

    // Rotate
    {
      if (ev.type === 'mousedown' && hit.area === 'rotate' && hitPage) {
        imgSvc.startHit = hit;

        const rect = el.getBoundingClientRect();
        const cx = imgSvc.c.width * hitPage.xc;
        const cy = imgSvc.c.height * hitPage.yc;

        const dx = ev.clientX - rect.left - cx;
        const dy = ev.clientY - rect.top - cy;
        imgSvc.rotationStartMouseAngle = Math.atan2(dy, dx);

        imgSvc.rotationStartPage = imgSvc.selectedPage;
        imgSvc.isRotating = true;
      }

      if (imgSvc.isRotating) {
        if (ev.type === 'mousemove') {
          this.rotatePage(cursor, ev, el);
        }

        if (ev.type === 'mouseup') {
          imgSvc.startHit = null;
          imgSvc.isRotating = false;
          imgSvc.rotationStartPage = null;
          imgSvc.pageWasEdited = true;
          imgSvc.updateMainImageItemAndImages();
        }
      }
    }

    // Resize
    {
      if (ev.type === 'mousedown' && (hit.area === 'edge' || hit.area === 'corner') && hitPage) {
        imgSvc.resizeMode = hit;
        imgSvc.resizeStartPage = imgSvc.selectedPage;
        imgSvc.resizeStartMouse = this.getMousePosOnMain(ev);
        imgSvc.resizeCursor = el.style.cursor;
      }

      if (ev.type === 'mousemove' && imgSvc.resizeMode && imgSvc.resizeStartPage) {
        imgSvc.isResizing = true;
        this.resizePage(ev, el);
      }

      if (ev.type === 'mouseup' && imgSvc.resizeMode) {
        imgSvc.isResizing = false;
        imgSvc.resizeMode = null;
        imgSvc.resizeStartPage = null;
        imgSvc.resizeStartMouse = null;
        imgSvc.pageWasEdited = true;
        imgSvc.updateMainImageItemAndImages();
      }
    }
  }

  private dragPage(e: MouseEvent): void {    
    const imgSvc = this.imagesService;
    if (!imgSvc.selectedPage) return;

    const { width, height } = imgSvc.c;
    const start = imgSvc.dragStartPage;
    if (!start || !imgSvc.dragStartMouse) return;
    const page = imgSvc.selectedPage;

    const dx = (e.clientX - imgSvc.dragStartMouse.x) / width;
    const dy = (e.clientY - imgSvc.dragStartMouse.y) / height;

    let newCx = start.xc + dx;
    let newCy = start.yc + dy;
    let newLeft = start.left + dx;
    let newRight = start.right + dx;
    let newTop = start.top + dy;
    let newBottom = start.bottom + dy;

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

    const updatedPage: Page = {
      ...page,
      xc: newCx,
      yc: newCy,
      left: newLeft,
      right: newRight,
      top: newTop,
      bottom: newBottom,
    };

    imgSvc.selectedPage = updatedPage;
    imgSvc.lastSelectedPage = updatedPage;
    imgSvc.currentPages = imgSvc.currentPages.map(p =>
      p._id === updatedPage._id ? updatedPage : p
    );

    imgSvc.redrawImage();
    imgSvc.currentPages.forEach(p => imgSvc.drawPage(p));
  }

  private rotatePage(cursor: string, ev: MouseEvent, el: HTMLElement): void {
    const imgSvc = this.imagesService;
    if (!imgSvc.rotationStartPage) return;

    if (imgSvc.startHit?.corner === 'ne') cursor = this.rotateCursorTopRight;
    if (imgSvc.startHit?.corner === 'nw') cursor = this.rotateCursorTopLeft;
    if (imgSvc.startHit?.corner === 'se') cursor = this.rotateCursorBottomRight;
    if (imgSvc.startHit?.corner === 'sw') cursor = this.rotateCursorBottomLeft;
    el.style.cursor = cursor;
    
    const startPage = imgSvc.rotationStartPage;
    
    const rect = el.getBoundingClientRect();
    const cx = imgSvc.c.width * startPage.xc;
    const cy = imgSvc.c.height * startPage.yc;

    const dx = ev.clientX - rect.left - cx;
    const dy = ev.clientY - rect.top - cy;

    const currentMouseAngle = Math.atan2(dy, dx);

    let delta = currentMouseAngle - imgSvc.rotationStartMouseAngle;

    let proposedAngle = startPage.angle + radianToDegree(delta);
    proposedAngle = ((proposedAngle + 180) % 360 + 360) % 360 - 180;

    const canRotate = (angle: number) => {
      const bounds = imgSvc.computeBounds(startPage.xc, startPage.yc, startPage.width, startPage.height, angle);
      return bounds.left >= 0 && bounds.right <= 1 && bounds.top >= 0 && bounds.bottom <= 1;
    }

    if (!canRotate(proposedAngle)) {
      const step = (proposedAngle - startPage.angle) > 0 ? imgSvc.incrementAngle : -imgSvc.incrementAngle;

      let temp = startPage.angle;
      while (canRotate(temp + step)) temp += step;

      proposedAngle = temp;
    }

    // Build updated page
    if (!imgSvc.selectedPage) return;

    const bounds = imgSvc.computeBounds(startPage.xc, startPage.yc, startPage.width, startPage.height, proposedAngle);
    const updatedPage: Page = {
      ...imgSvc.selectedPage,
      angle: proposedAngle,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
    };

    // Update state
    imgSvc.selectedPage = updatedPage;
    imgSvc.lastSelectedPage = updatedPage;
    imgSvc.currentPages = imgSvc.currentPages.map(p =>
      p._id === updatedPage._id ? updatedPage : p
    );

    imgSvc.redrawImage();
    imgSvc.currentPages.forEach(p => imgSvc.drawPage(p));
  }

  private resizePage(ev: MouseEvent, el: HTMLElement): void {
    const imgSvc = this.imagesService;
    const mode = imgSvc.resizeMode;
    const startPage = imgSvc.resizeStartPage;
    if (!mode || !startPage) return;

    el.style.cursor = imgSvc.resizeCursor;

    const updated = structuredClone(startPage);

    if (mode.area === 'edge') {
      this.applyEdgeResize(updated, startPage, mode.edgeSide!, ev);
    }

    if (mode.area === 'corner') {
      this.applyCornerResize(updated, startPage, mode.corner!);
    }
  }

  // TO DO: REFACTOR!
  private applyEdgeResize(p: Page, start: Page, userSide: EdgeSide, ev: MouseEvent) {
    const c = this.imagesService.c;
    const cw = c.width;
    const ch = c.height;
    const ratio = cw / ch;
    const inverseRatio = ch / cw;

    const startMouse = this.imagesService.resizeStartMouse;
    const mouse = this.getMousePosOnMain(ev);
    if (!mouse || !startMouse) return;

    const mx = mouse.x - startMouse.x;
    const my = mouse.y - startMouse.y;

    let newWidth = start.width;
    let newHeight = start.height;
    let newLeft = start.left;
    let newRight = start.right;
    let newTop = start.top;
    let newBottom = start.bottom;
    let newXc = start.xc;
    let newYc = start.yc;

    if ([0, -180, 90, -90].includes(start.angle)) {
      const dx = mx / cw;
      const dy = my / ch;
      
      if (userSide === 'left' || userSide === 'right') {
        if (userSide === 'right') {
          newRight = start.right + dx;
          if (newRight < newLeft) newRight = start.left;
        } else {
          newLeft = start.left + dx;
          if (newRight < newLeft) newLeft = start.right;
        }

        if ([0, -180].includes(start.angle)) {
          newWidth = newRight - newLeft;
          if (newWidth < 0) newWidth = 0;
          if (userSide === 'right' && start.angle === 0 && newWidth > 1 - start.left) {
            newWidth = 1 - start.left;
            newRight = 1;
          }
          if (userSide === 'left' && start.angle === 0 && newWidth > start.right) {
            newWidth = start.right;
            newLeft = 0;
          }
          if (userSide === 'left' && start.angle === -180 && newWidth > start.right) {
            newWidth = start.right;
            newLeft = 0;
          }
          if (userSide === 'right' && start.angle === -180 && newWidth > 1 - start.left) {
            newWidth = 1 - start.left;
            newRight = 1;
          }
        } else {
          newHeight = (newRight - newLeft) * ratio;
          if (newHeight < 0) newHeight = 0;
          if (userSide === 'right' && start.angle === 90 && newHeight * inverseRatio > 1 - start.left) {
            newHeight = (1 - start.left) * ratio;
            newRight = 1;
          }
          if (userSide === 'left' && start.angle === 90 && newHeight * inverseRatio > start.right) {
            newHeight = start.right * ratio;
            newLeft = 0;
          }
          if (userSide === 'left' && start.angle === -90 && newHeight * inverseRatio > start.right) {
            newHeight = start.right * ratio;
            newLeft = 0;
          }
          if (userSide === 'right' && start.angle === -90 && newHeight * inverseRatio > 1 - start.left) {
            newHeight = (1 - start.left) * ratio;
            newRight = 1;
          }
        }
        newXc = (newLeft + newRight) / 2;
      }

      if (userSide === 'top' || userSide === 'bottom') {
        if (userSide === 'bottom') {
          newBottom = start.bottom + dy;
          if (newBottom < newTop) newBottom = start.top;
        } else {
          newTop = start.top + dy;
          if (newBottom < newTop) newTop = start.bottom;
        }

        if ([0, -180].includes(start.angle)) {
          newHeight = newBottom - newTop;
          if (newHeight < 0) newHeight = 0;
          if (userSide === 'bottom' && start.angle === 0 && newHeight > 1 - start.top) {
            newHeight = 1 - start.top;
            newBottom = 1;
          }
          if (userSide === 'top' && start.angle === 0 && newHeight > start.bottom) {
            newHeight = start.bottom;
            newTop = 0;
          }
          if (userSide === 'top' && start.angle === -180 && newHeight > start.bottom) {
            newHeight = start.bottom;
            newTop = 0;
          }
          if (userSide === 'bottom' && start.angle === -180 && newHeight > 1 - start.top) {
            newHeight = 1 - start.top;
            newBottom = 1;
          }
        } else {
          newWidth = (newBottom - newTop) * inverseRatio;
          if (newWidth < 0) newWidth = 0;
          if (userSide === 'bottom' && start.angle === 90 && newWidth * ratio > 1 - start.top) {
            newWidth = (1 - start.top) * inverseRatio;
            newBottom = 1;
          }
          if (userSide === 'top' && start.angle === 90 && newWidth * ratio > start.bottom) {
            newWidth = start.bottom * inverseRatio;
            newTop = 0;
          }
          if (userSide === 'top' && start.angle === -90 && newWidth * ratio > start.bottom) {
            newWidth = start.bottom * inverseRatio;
            newTop = 0;
          }
          if (userSide === 'bottom' && start.angle === -90 && newWidth * ratio > 1 - start.top) {
            newWidth = (1 - start.top) * inverseRatio;
            newBottom = 1;
          }
        }
        newYc = (newTop + newBottom) / 2;
      }
    }

    // 0-90 degrees
    if (start.angle > 0 && start.angle < 90) {
      const rad = degreeToRadian(start.angle);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      if (
        (start.angle > 0 && start.angle <= 45 && userSide === 'right')
        || (start.angle > 45 && start.angle < 90 && userSide === 'bottom')
      ) {
        const hypot = mx * cos + my * sin;
        const dx = cos * hypot / cw;
        const dy = sin * hypot / ch;

        newWidth = start.width + hypot / cw;
        newRight = start.right + dx;
        newBottom = start.bottom + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newWidth < 0) {
          newWidth = 0;
          newRight = start.right - cos * start.width;
          newBottom = start.bottom - sin * start.width * ratio;
          newXc = (newRight - start.left) / 2 + start.left;
          newYc = (newBottom - start.top) / 2 + start.top;
        }

        if (newRight > 1) {
          newRight = 1;
          newWidth = start.width + (1 - start.right) / cos;
          newBottom = start.bottom + (newWidth - start.width) * sin * ratio;
          newXc = start.xc + (cos * (newWidth - start.width)) / 2;
          newYc = start.yc + ((newWidth - start.width) * sin * ratio) / 2;
        }

        if (newBottom > 1) {
          newBottom = 1;
          newWidth = start.width + (1 - start.bottom) * inverseRatio / sin;
          newRight = start.right + (newWidth - start.width) * cos;
          newXc = start.xc + (cos * (newWidth - start.width)) / 2;
          newYc = start.yc + ((newWidth - start.width) * sin * ratio) / 2;
        }
      }

      if (
        (start.angle > 0 && start.angle <= 45 && userSide === 'bottom')
        || (start.angle > 45 && start.angle < 90 && userSide === 'left')
      ) {
        const hypot = mx * (-sin) + my * cos;
        const dx = (-sin) * hypot / cw;
        const dy = cos * hypot / ch;

        newHeight = start.height + hypot / ch;
        newLeft = start.left + dx;
        newBottom = start.bottom + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newHeight < 0) {
          newHeight = 0;
          newLeft = start.left + sin * start.height * inverseRatio;
          newBottom = start.bottom - cos * start.height;
          newXc = (start.right - newLeft) / 2 + newLeft;
          newYc = (newBottom - start.top) / 2 + start.top;
        }

        if (newLeft < 0) {
          newLeft = 0;
          newHeight = start.height + start.left / sin * ratio;
          newBottom = start.bottom + (newHeight - start.height) * cos;
          newXc = start.xc - (sin * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc + ((newHeight - start.height) * cos) / 2;
        }

        if (newBottom > 1) {
          newBottom = 1;
          newHeight = start.height + (1 - start.bottom) / cos;
          newLeft = start.left - (newHeight - start.height) * sin * inverseRatio;
          newXc = start.xc - (sin * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc + ((newHeight - start.height) * cos) / 2;
        }
      }

      if (
        (start.angle > 0 && start.angle <= 45 && userSide === 'left')
        || (start.angle > 45 && start.angle < 90 && userSide === 'top')
      ) {
        const hypot = mx * cos + my * sin;
        const dx = cos * hypot / cw;
        const dy = sin * hypot / ch;

        newWidth = start.width - hypot / cw;
        newLeft = start.left + dx;
        newTop = start.top + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newWidth < 0) {
          newWidth = 0;
          newLeft = start.left + cos * start.width;
          newTop = start.top + sin * start.width * ratio;
          newXc = (start.right - newLeft) / 2 + newLeft;
          newYc = (start.bottom - newTop) / 2 + newTop;
        }

        if (newLeft < 0) {
          newLeft = 0;
          newWidth = start.width + start.left / cos;
          newTop = start.top - (newWidth - start.width) * sin * ratio;
          newXc = start.xc - (cos * (newWidth - start.width)) / 2;
          newYc = start.yc - ((newWidth - start.width) * sin * ratio) / 2;
        }

        if (newTop < 0) {
          newTop = 0;
          newWidth = start.width + start.top * inverseRatio / sin;
          newLeft = start.left - (newWidth - start.width) * cos;
          newXc = start.xc - (cos * (newWidth - start.width)) / 2;
          newYc = start.yc - ((newWidth - start.width) * sin * ratio) / 2;
        }
      }

      if (
        (start.angle > 0 && start.angle <= 45 && userSide === 'top')
        || (start.angle > 45 && start.angle < 90 && userSide === 'right')
      ) {
        const hypot = mx * (-sin) + my * cos;
        const dx = (-sin) * -hypot / cw;
        const dy = cos * -hypot / ch;

        newHeight = start.height - hypot / ch;
        newRight = start.right - dx;
        newTop = start.top - dy;
        newXc = start.xc - dx / 2;
        newYc = start.yc - dy / 2;

        if (newHeight < 0) {
          newHeight = 0;
          newRight = start.right - sin * start.height * inverseRatio;
          newTop = start.top + cos * start.height;
          newXc = (newRight - start.left) / 2 + start.left;
          newYc = (start.bottom - newTop) / 2 + newTop;
        }

        if (newRight > 1) {
          newRight = 1;
          newHeight = start.height + (1 - start.right) / sin * ratio;
          newTop = start.top - (newHeight - start.height) * cos;
          newXc = start.xc + (sin * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc - ((newHeight - start.height) * cos) / 2;
        }

        if (newTop < 0) {
          newTop = 0;
          newHeight = start.height + start.top / cos;
          newRight = start.right + (newHeight - start.height) * sin * inverseRatio;
          newXc = start.xc + (sin * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc - ((newHeight - start.height) * cos) / 2;
        }
      }
    }

    // 90-180 degrees
    if (start.angle > 90 && start.angle < 180) {
      const rad = degreeToRadian(start.angle - 90);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      if (
        (start.angle > 90 && start.angle <= 135 && userSide === 'right')
        || (start.angle > 135 && start.angle < 180 && userSide === 'bottom')
      ) {
        const hypot = mx * cos + my * sin;
        const dx = cos * hypot / cw;
        const dy = sin * hypot / ch;

        newHeight = start.height + hypot / ch;
        newRight = start.right + dx;
        newBottom = start.bottom + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newHeight < 0) {
          newHeight = 0;
          newRight = start.right - cos * start.height * inverseRatio;
          newBottom = start.bottom - sin * start.height;
          newXc = (newRight - start.left) / 2 + start.left;
          newYc = (newBottom - start.top) / 2 + start.top;
        }

        if (newRight > 1) {
          newRight = 1;
          newHeight = start.height + (1 - start.right) / cos * ratio;
          newBottom = start.bottom + (newHeight - start.height) * sin;
          newXc = start.xc + (cos * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc + ((newHeight - start.height) * sin) / 2;
        }

        if (newBottom > 1) {
          newBottom = 1;
          newHeight = start.height + (1 - start.bottom) / sin;
          newRight = start.right + (newHeight - start.height) * cos * inverseRatio;
          newXc = start.xc + (cos * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc + ((newHeight - start.height) * sin) / 2;
        }
      }

      if (
        (start.angle > 90 && start.angle <= 135 && userSide === 'bottom')
        || (start.angle > 135 && start.angle < 180 && userSide === 'left')
      ) {
        const hypot = mx * (-sin) + my * cos;
        const dx = (-sin) * hypot / cw;
        const dy = cos * hypot / ch;

        newWidth = start.width + hypot / cw;
        newLeft = start.left + dx;
        newBottom = start.bottom + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newWidth < 0) {
          newWidth = 0;
          newLeft = start.left + sin * start.width;
          newBottom = start.bottom - cos * start.width * ratio;
          newXc = (start.right - newLeft) / 2 + newLeft;
          newYc = (newBottom - start.top) / 2 + start.top;
        }

        if (newLeft < 0) {
          newLeft = 0;
          newWidth = start.width + start.left / sin;
          newBottom = start.bottom + (newWidth - start.width) * cos;
          newXc = start.xc - sin * (newWidth - start.width) / 2;
          newYc = start.yc + ((newWidth - start.width) * cos * ratio) / 2;
        }

        if (newBottom > 1) {
          newBottom = 1;
          newWidth = start.width + (1 - start.bottom) / cos * inverseRatio;
          newLeft = start.left - (newWidth - start.width) * sin;
          newXc = start.xc - sin * (newWidth - start.width) / 2;
          newYc = start.yc + ((newWidth - start.width) * cos * ratio) / 2;
        }
      }

      if (
        (start.angle > 90 && start.angle <= 135 && userSide === 'left')
        || (start.angle > 135 && start.angle < 180 && userSide === 'top')
      ) {
        const hypot = mx * cos + my * sin;
        const dx = cos * hypot / cw;
        const dy = sin * hypot / ch;

        newHeight = start.height - hypot / ch;
        newLeft = start.left + dx;
        newTop = start.top + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newHeight < 0) {
          newHeight = 0;
          newLeft = start.left + cos * start.height * inverseRatio;
          newTop = start.top + sin * start.height;
          newXc = (start.right - newLeft) / 2 + newLeft;
          newYc = (start.bottom - newTop) / 2 + newTop;
        }

        if (newLeft < 0) {
          newLeft = 0;
          newHeight = start.height + start.left / cos * ratio;
          newTop = start.top - (newHeight - start.height) * sin;
          newXc = start.xc - (cos * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc - ((newHeight - start.height) * sin) / 2;
        }

        if (newTop < 0) {
          newTop = 0;
          newHeight = start.height + start.top / sin;
          newLeft = start.left - (newHeight - start.height) * cos * inverseRatio;
          newXc = start.xc - (cos * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc - ((newHeight - start.height) * sin) / 2;
        }
      }

      if (
        (start.angle > 90 && start.angle <= 135 && userSide === 'top')
        || (start.angle > 135 && start.angle < 180 && userSide === 'right')
      ) {
        const hypot = mx * (-sin) + my * cos;
        const dx = (-sin) * -hypot / cw;
        const dy = cos * -hypot / ch;

        newWidth = start.width - hypot / cw;
        newRight = start.right - dx;
        newTop = start.top - dy;
        newXc = start.xc - dx / 2;
        newYc = start.yc - dy / 2;

        if (newWidth < 0) {
          newWidth = 0;
          newRight = start.right - sin * start.width;
          newTop = start.top + cos * start.width * ratio;
          newXc = (newRight - start.left) / 2 + start.left;
          newYc = (start.bottom - newTop) / 2 + newTop;
        }

        if (newRight > 1) {
          newRight = 1;
          newWidth = start.width + (1 - start.right) / sin;
          newTop = start.top - (newWidth - start.width) * cos * ratio;
          newXc = start.xc + (sin * (newWidth - start.width)) / 2;
          newYc = start.yc - ((newWidth - start.width) * cos * ratio) / 2;
        }

        if (newTop < 0) {
          newTop = 0;
          newWidth = start.width + start.top / cos * inverseRatio;
          newRight = start.right + (newWidth - start.width) * sin;
          newXc = start.xc + (sin * (newWidth - start.width)) / 2;
          newYc = start.yc - ((newWidth - start.width) * cos * ratio) / 2;
        }
      }
    }

    // -180 - -90 degrees
    if (start.angle > -180 && start.angle < -90) {
      const rad = degreeToRadian(-start.angle - 90);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      if (
        (start.angle > -180 && start.angle <= -135 && userSide === 'right')
        || (start.angle > -135 && start.angle < -90 && userSide === 'bottom')
      ) {
        const hypot = mx * sin + my * cos;
        const dx = sin * hypot / cw;
        const dy = cos * hypot / ch;

        newWidth = start.width + hypot / cw;
        newRight = start.right + dx;
        newBottom = start.bottom + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newWidth < 0) {
          newWidth = 0;
          newRight = start.right - sin * start.width;
          newBottom = start.bottom - cos * start.width * ratio;
          newXc = (newRight - start.left) / 2 + start.left;
          newYc = (newBottom - start.top) / 2 + start.top;
        }

        if (newRight > 1) {
          newRight = 1;
          newWidth = start.width + (1 - start.right) / sin;
          newBottom = start.bottom + (newWidth - start.width) * cos * ratio;
          newXc = start.xc + (sin * (newWidth - start.width)) / 2;
          newYc = start.yc + ((newWidth - start.width) * cos * ratio) / 2;
        }

        if (newBottom > 1) {
          newBottom = 1;
          newWidth = start.width + (1 - start.bottom) * inverseRatio / cos;
          newRight = start.right + (newWidth - start.width) * sin;
          newXc = start.xc + (sin * (newWidth - start.width)) / 2;
          newYc = start.yc + ((newWidth - start.width) * cos * ratio) / 2;
        }
      }

      if (
        (start.angle > -180 && start.angle <= -135 && userSide === 'bottom')
        || (start.angle > -135 && start.angle < -90 && userSide === 'left')
      ) {
        const hypot = mx * (-cos) + my * sin;
        const dx = (-cos) * hypot / cw;
        const dy = sin * hypot / ch;

        newHeight = start.height + hypot / ch;
        newLeft = start.left + dx;
        newBottom = start.bottom + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newHeight < 0) {
          newHeight = 0;
          newLeft = start.left + cos * start.height * inverseRatio;
          newBottom = start.bottom - sin * start.height;
          newXc = (start.right - newLeft) / 2 + newLeft;
          newYc = (newBottom - start.top) / 2 + start.top;
        }

        if (newLeft < 0) {
          newLeft = 0;
          newHeight = start.height + start.left / cos * ratio;
          newBottom = start.bottom + (newHeight - start.height) * sin;
          newXc = start.xc - (cos * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc + ((newHeight - start.height) * sin) / 2;
        }

        if (newBottom > 1) {
          newBottom = 1;
          newHeight = start.height + (1 - start.bottom) / sin;
          newLeft = start.left - (newHeight - start.height) * cos * inverseRatio;
          newXc = start.xc - (cos * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc + ((newHeight - start.height) * sin) / 2;
        }
      }

      if (
        (start.angle > -180 && start.angle <= -135 && userSide === 'left')
        || (start.angle > -135 && start.angle < -90 && userSide === 'top')
      ) {
        const hypot = mx * sin + my * cos;
        const dx = sin * hypot / cw;
        const dy = cos * hypot / ch;

        newWidth = start.width - hypot / cw;
        newLeft = start.left + dx;
        newTop = start.top + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newWidth < 0) {
          newWidth = 0;
          newLeft = start.left + sin * start.width;
          newTop = start.top + cos * start.width * ratio;
          newXc = (start.right - newLeft) / 2 + newLeft;
          newYc = (start.bottom - newTop) / 2 + newTop;
        }

        if (newLeft < 0) {
          newLeft = 0;
          newWidth = start.width + start.left / sin;
          newTop = start.top - (newWidth - start.width) * cos * ratio;
          newXc = start.xc - (sin * (newWidth - start.width)) / 2;
          newYc = start.yc - ((newWidth - start.width) * cos * ratio) / 2;
        }

        if (newTop < 0) {
          newTop = 0;
          newWidth = start.width + start.top * inverseRatio / cos;
          newLeft = start.left - (newWidth - start.width) * sin;
          newXc = start.xc - (sin * (newWidth - start.width)) / 2;
          newYc = start.yc - ((newWidth - start.width) * cos * ratio) / 2;
        }
      }

      if (
        (start.angle > -180 && start.angle <= -135 && userSide === 'top')
        || (start.angle > -135 && start.angle < -90 && userSide === 'right')
      ) {
        const hypot = mx * (-cos) + my * sin;
        const dx = (-cos) * -hypot / cw;
        const dy = sin * -hypot / ch;

        newHeight = start.height - hypot / ch;
        newRight = start.right - dx;
        newTop = start.top - dy;
        newXc = start.xc - dx / 2;
        newYc = start.yc - dy / 2;

        if (newHeight < 0) {
          newHeight = 0;
          newRight = start.right - cos * start.height * inverseRatio;
          newTop = start.top + sin * start.height;
          newXc = (newRight - start.left) / 2 + start.left;
          newYc = (start.bottom - newTop) / 2 + newTop;
        }

        if (newRight > 1) {
          newRight = 1;
          newHeight = start.height + (1 - start.right) / cos * ratio;
          newTop = start.top - (newHeight - start.height) * sin;
          newXc = start.xc + (cos * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc - ((newHeight - start.height) * sin) / 2;
        }

        if (newTop < 0) {
          newTop = 0;
          newHeight = start.height + start.top / sin;
          newRight = start.right + (newHeight - start.height) * cos * inverseRatio;
          newXc = start.xc + (cos * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc - ((newHeight - start.height) * sin) / 2;
        }
      }
    }

    // -90-0 degrees
    if (start.angle > -90 && start.angle < 0) {
      const rad = degreeToRadian(-start.angle);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      if (
        (start.angle > -90 && start.angle < -45 && userSide === 'right')
        || (start.angle >= -45 && start.angle < 0 && userSide === 'bottom')
      ) {
        const hypot = mx * sin + my * cos;
        const dx = sin * hypot / cw;
        const dy = cos * hypot / ch;

        newHeight = start.height + hypot / ch;
        newRight = start.right + dx;
        newBottom = start.bottom + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newHeight < 0) {
          newHeight = 0;
          newRight = start.right - sin * start.height * inverseRatio;
          newBottom = start.bottom - cos * start.height;
          newXc = (newRight - start.left) / 2 + start.left;
          newYc = (newBottom - start.top) / 2 + start.top;
        }

        if (newRight > 1) {
          newRight = 1;
          newHeight = start.height + (1 - start.right) / sin * ratio;
          newBottom = start.bottom + (newHeight - start.height) * cos;
          newXc = start.xc + (sin * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc + ((newHeight - start.height) * cos) / 2;
        }

        if (newBottom > 1) {
          newBottom = 1;
          newHeight = start.height + (1 - start.bottom) / cos;
          newRight = start.right + (newHeight - start.height) * sin * inverseRatio;
          newXc = start.xc + (sin * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc + ((newHeight - start.height) * cos) / 2;
        }
      }

      if (
        (start.angle > -90 && start.angle < -45 && userSide === 'bottom')
        || (start.angle >= -45 && start.angle < 0 && userSide === 'left')
      ) {
        const hypot = mx * (-cos) + my * sin;
        const dx = (-cos) * hypot / cw;
        const dy = sin * hypot / ch;

        newWidth = start.width + hypot / cw;
        newLeft = start.left + dx;
        newBottom = start.bottom + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newWidth < 0) {
          newWidth = 0;
          newLeft = start.left + cos * start.width;
          newBottom = start.bottom - sin * start.width * ratio;
          newXc = (start.right - newLeft) / 2 + newLeft;
          newYc = (newBottom - start.top) / 2 + start.top;
        }

        if (newLeft < 0) {
          newLeft = 0;
          newWidth = start.width + start.left / cos;
          newBottom = start.bottom + (newWidth - start.width) * sin;
          newXc = start.xc - cos * (newWidth - start.width) / 2;
          newYc = start.yc + ((newWidth - start.width) * sin * ratio) / 2;
        }

        if (newBottom > 1) {
          newBottom = 1;
          newWidth = start.width + (1 - start.bottom) / sin * inverseRatio;
          newLeft = start.left - (newWidth - start.width) * cos;
          newXc = start.xc - cos * (newWidth - start.width) / 2;
          newYc = start.yc + ((newWidth - start.width) * sin * ratio) / 2;
        }
      }

      if (
        (start.angle > -90 && start.angle < -45 && userSide === 'left')
        || (start.angle >= -45 && start.angle < 0 && userSide === 'top')
      ) {
        const hypot = mx * sin + my * cos;
        const dx = sin * hypot / cw;
        const dy = cos * hypot / ch;

        newHeight = start.height - hypot / ch;
        newLeft = start.left + dx;
        newTop = start.top + dy;
        newXc = start.xc + dx / 2;
        newYc = start.yc + dy / 2;

        if (newHeight < 0) {
          newHeight = 0;
          newLeft = start.left + sin * start.height * inverseRatio;
          newTop = start.top + cos * start.height;
          newXc = (start.right - newLeft) / 2 + newLeft;
          newYc = (start.bottom - newTop) / 2 + newTop;
        }

        if (newLeft < 0) {
          newLeft = 0;
          newHeight = start.height + start.left / sin * ratio;
          newTop = start.top - (newHeight - start.height) * cos;
          newXc = start.xc - (sin * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc - ((newHeight - start.height) * cos) / 2;
        }

        if (newTop < 0) {
          newTop = 0;
          newHeight = start.height + start.top / cos;
          newLeft = start.left - (newHeight - start.height) * sin * inverseRatio;
          newXc = start.xc - (sin * (newHeight - start.height) * inverseRatio) / 2;
          newYc = start.yc - ((newHeight - start.height) * cos) / 2;
        }
      }

      if (
        (start.angle > -90 && start.angle < -45 && userSide === 'top')
        || (start.angle >= -45 && start.angle < 0 && userSide === 'right')
      ) {
        const hypot = mx * (-cos) + my * sin;
        const dx = (-cos) * -hypot / cw;
        const dy = sin * -hypot / ch;

        newWidth = start.width - hypot / cw;
        newRight = start.right - dx;
        newTop = start.top - dy;
        newXc = start.xc - dx / 2;
        newYc = start.yc - dy / 2;

        if (newWidth < 0) {
          newWidth = 0;
          newRight = start.right - cos * start.width;
          newTop = start.top + sin * start.width * ratio;
          newXc = (newRight - start.left) / 2 + start.left;
          newYc = (start.bottom - newTop) / 2 + newTop;
        }

        if (newRight > 1) {
          newRight = 1;
          newWidth = start.width + (1 - start.right) / cos;
          newTop = start.top - (newWidth - start.width) * sin * ratio;
          newXc = start.xc + (cos * (newWidth - start.width)) / 2;
          newYc = start.yc - ((newWidth - start.width) * sin * ratio) / 2;
        }

        if (newTop < 0) {
          newTop = 0;
          newWidth = start.width + start.top / sin * inverseRatio;
          newRight = start.right + (newWidth - start.width) * cos;
          newXc = start.xc + (cos * (newWidth - start.width)) / 2;
          newYc = start.yc - ((newWidth - start.width) * sin * ratio) / 2;
        }
      }
    }

    p.width = newWidth;
    p.height = newHeight;
    p.left = newLeft;
    p.right = newRight;
    p.top = newTop;
    p.bottom = newBottom;
    p.xc = newXc;
    p.yc = newYc;

    const imgSvc = this.imagesService;
    imgSvc.selectedPage = p;
    imgSvc.currentPages = imgSvc.currentPages.map(page => page._id === p._id ? p : page);
    imgSvc.redrawImage();
    imgSvc.currentPages.forEach(p => imgSvc.drawPage(p));
  }

  private applyCornerResize(p: Page, start: Page, userCorner: CornerName) {
    
  }
}
