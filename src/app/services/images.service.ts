import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { DialogButton, DialogContentType, GridMode, HitInfo, ImageItem, ImgOrCanvas, MousePos, Page, Toast, ToastType } from '../app.types';
import { catchError, Observable, of } from 'rxjs';
import { clamp, defer, degreeToRadian, getColor, scrollToSelectedImage } from '../utils/utils';
import { EnvironmentService } from './environment.service';
import { gridColor, transparentColor } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);
  private envService = inject(EnvironmentService);
  
  private get serverBaseUrl(): string {
    // Because envService might not be initialized at construction time
    return this.envService.get('serverBaseUrl') as string;
  }


  /* ------------------------------
    STATE
  ------------------------------ */
  book = signal<string>('');
  selectedFilter: string | null = null;
  editable = signal<boolean>(false);

  images = signal<ImageItem[]>([]);
  originalImages = signal<ImageItem[]>([]);
  displayedImages = signal<ImageItem[]>([]);

  mainImageItem = signal<ImageItem>({ _id: '', url: '', thumbnailUrl: '', edited: false, flags: [], pages: [] });
  emptyImageItem: ImageItem = { _id: '', url: '', edited: false, flags: [], pages: [] };
  imgWasEdited: boolean = false;

  c!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  currentIndex = computed<number>(() => this.displayedImages().findIndex(img => img._id === this.mainImageItem()._id));
  mainImage: HTMLImageElement | null = null;
  lastBook: string = '';
  lastMode: string = '';
  loadingLeft: boolean = false;
  loadingMain: boolean = false;

  // Interactions
  pageWasEdited: boolean = false;
  currentPages: Page[] = [];
  selectedPage: Page | null = null;
  lastSelectedPage: Page | null = null;
  clickedDiffPage: boolean | null = null;

  pageId!: string;
  hitPage!: Page | null;
  mousePos!: { x: number; y: number } | null;
  startHit: HitInfo | null = null;

  // Hover
  lastPageCursorIsInside: Page | null = null;
  isShiftActive: boolean = false;

  // Drag
  isDragging: boolean = false;
  dragStartPage: Page | null = null;
  dragStartMouse: MousePos | null = null;
  
  // Rotate
  isRotating: boolean = false;
  rotationStartPage: Page | null = null;
  rotationStartMouseAngle: number = 0;
  gridMode = signal<GridMode>('when-rotating');
  gridRadio = signal<GridMode>('when-rotating');

  // Resize
  isResizing: boolean = false;
  resizeStartPage: Page | null = null;
  resizeStartMouse: MousePos | null = null;
  resizeMode: HitInfo | null = null;
  resizeCursor!: string;
  
  // Inputs
  lastLeftInput: number = 0;
  lastTopInput: number = 0;
  lastWidthInput: number = 0;
  lastHeightInput: number = 0;
  lastAngleInput: number = 0;
  increment: number = 0.001;
  incrementAngle: number = this.increment * 100;
  decimals: number = 2;
  rotationDirection: number = 1;

  outlineTransparent: boolean = false;
  pageOutlineWidth: number = 3;
  cornerSize: number = 6;
  maxPages: number = 2;


  /* ------------------------------
    DERIVED STATE
  ------------------------------ */
  flaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.edited && img.flags.length));
  notFlaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.edited && !img.flags.length));
  editedImages = computed<ImageItem[]>(() => this.images().filter(img => img.edited));
  singlePagesImages = computed<ImageItem[]>(() => this.images().filter(img => img.pages.length === 1));
  doublePagesImages = computed<ImageItem[]>(() => this.images().filter(img => img.pages.length === 2));


  /* ------------------------------
    API
  ------------------------------ */
  private apiUrl: string = 'https://api.ai-orezy.trinera.cloud';

  private headers(type: string = 'json', contentType: boolean = false): HttpHeaders {
    const authType = 'Bearer';
    const token = '2fMRGgdFqWG1xJdPoiyVT6hKuwxKe2JmimxPbDtrmrpOUuW86uLwdGurVDxLPjPT';

    return new HttpHeaders({
      accept: type === 'json' ? 'application/json' : '*/*',
      Authorization: `${authType} ${token}`,
      ...(contentType && { 'Content-Type': 'application/json' })
    });
  }

  fetchAllTitleIds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/title-ids`, { headers: this.headers() });
  }

  fetchScans(id: string): Observable<ImageItem[]> {
    return this.http.get<ImageItem[]>(`${this.apiUrl}/${id}/scans`, { headers: this.headers() });
  }

  fetchThumbnail(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${this.book()}/thumbnails/${id}`, { 
      responseType: 'blob',
      headers: this.headers('*/*')
    });
  }

  fetchImage(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${this.book()}/files/${id}`, { 
      responseType: 'blob',
      headers: this.headers('*/*')
    });
  }

  updatePages(id: string, payload: ImageItem[]): any {
    return this.http.patch(`${this.apiUrl}/${id}/update-pages`, payload, { headers: this.headers('json', true) });
  }

  reset(id: string): Observable<ImageItem[]> {
    return this.http.patch<ImageItem[]>(`${this.apiUrl}/${id}/reset`, {}, { headers: this.headers('json', false) });
  }


  /* ------------------------------
    API ACTIONS
  ------------------------------ */
  finishEverything(): void {
    if (this.pageWasEdited) this.updateCurrentPagesWithEdited();
    if (this.imgWasEdited) this.updateImagesByEdited(this.mainImageItem()._id);
    this.selectedPage = null;
    this.updateMainImageItemAndImages();
    this.redrawImage();
    this.currentPages.forEach(p => this.drawPage(p));
    this.updatePages(this.book(), this.images().filter(img => img.edited))
      .subscribe({
        next: () => {
          this.selectedFilter = 'edited';
          localStorage.setItem('filter', this.selectedFilter);
          this.setDisplayedImages();
          this.showToast('Proces byl úspěšně dokončen!', { type: 'success' });
        },
        error: (err: Error) => console.error(err)
      });
  }

  resetScan(): void {
    if (!this.displayedImages().length) return;

    const mainImageItemBefore = this.mainImageItem();
    this.mainImageItem.set(this.originalImages().find(img => img._id === mainImageItemBefore._id) ?? mainImageItemBefore);
    const mainImageItemAfter = this.mainImageItem();
    this.images.update(prev =>
      prev.map(img => img._id === mainImageItemAfter._id
        ? mainImageItemAfter
        : img
      )
    );

    if (['single', 'double'].includes(this.selectedFilter ?? '')) {
      if (this.selectedFilter === 'single' && mainImageItemAfter.pages.length === 2) this.selectedFilter = 'double';
      if (this.selectedFilter === 'double' && mainImageItemAfter.pages.length === 1) this.selectedFilter = 'single';
    } else {
      this.selectedFilter = mainImageItemAfter.edited && this.editedImages().length
        ? 'edited'
        : (mainImageItemAfter.flags.length ? 'flagged' : 'ok');
    }
    localStorage.setItem('filter', this.selectedFilter ?? 'flagged');
    this.setDisplayedImages();
    scrollToSelectedImage();
    this.setMainImage(mainImageItemAfter);

    this.imgWasEdited = false;

    this.showToast('Změny skenu byly úspěšně resetovány!', { type: 'success' });
  }

  resetDoc(): void {
    this.reset(this.book()).pipe(
      catchError(err => {
        console.error('Fetch error:', err);
        return of([]);
      })
    ).subscribe((response: ImageItem[]) => {
      this.images.set(response);
      this.originalImages.set(response);
      
      if (this.selectedFilter === 'edited') this.selectedFilter = 'flagged';
      this.setDisplayedImages();
      this.setMainImage(this.displayedImages()[0]);

      this.showToast('Změny dokumentu byly úspěšně resetovány!', { type: 'success' });
    });
  }


  /* ------------------------------
    LEFT PANEL
  ------------------------------ */
  setDisplayedImages(): void {
    switch (this.selectedFilter) {
      case 'all':
        this.displayedImages.set(this.images());
        break;
      case 'flagged':
        this.displayedImages.set(this.flaggedImages());
        break;
      case 'edited':
        this.displayedImages.set(this.editedImages());
        break;
      case 'ok':
        this.displayedImages.set(this.notFlaggedImages());
        break;
      case 'double':
        this.displayedImages.set(this.doublePagesImages());
        break;
      case 'single':
        this.displayedImages.set(this.singlePagesImages());
        break;
    }
  }

  switchFilter(filter: string): void {
    this.updateImagesByCurrentPages();
    
    this.selectedFilter = filter;
    localStorage.setItem('filter', this.selectedFilter);
    
    const mainImageItemName = this.mainImageItem()._id;
    if (this.imgWasEdited) {
      this.updateImagesByEdited(mainImageItemName ?? '');
      this.showToast('Sken byl přesunut do Upravených.');
    }

    this.setDisplayedImages();

    const newImage = this.displayedImages().find(img => img._id === mainImageItemName)
      || this.displayedImages()[0]
      || { url: '' };
    this.setMainImage(newImage);

    scrollToSelectedImage();
  }


  /* ------------------------------
    MAIN IMAGE LOGIC
  ------------------------------ */
  setMainImage(img: ImageItem): void {
    this.loadingMain = true;
    const mainImage = (document.getElementById('main-image') as HTMLElement).style;
    const mainCanvas =(document.getElementById('main-canvas') as HTMLElement).style;
    mainImage.visibility = 'hidden';
    mainCanvas.visibility = 'hidden';

    const applyFinalImage = (updated: ImageItem) => {
      const page = this.clickedDiffPage ? this.lastSelectedPage : this.selectedPage;
      if (this.pageWasEdited && page) {
        page.edited = true;
        this.pageWasEdited = false;
      }
      this.selectedPage = null;
      this.editable.set(false);
      this.toggleMainImageOrCanvas();
      this.renderFullImageAndCanvas(updated);
      this.loadingMain = false;
      defer(() => this.setDisplayedImages(), 100);
    };

    if (img.url) {
      applyFinalImage(img);
      return;
    }

    if (!img._id) {
      this.loadingMain = false;
      return;
    }

    this.fetchImage(img._id).subscribe(blob => {
      const url = URL.createObjectURL(blob);

      this.images.update(prev =>
        prev.map(image =>
          image._id === img._id ? { ...image, url } : image
        )
      );

      applyFinalImage({ ...img, url });
    });
  }

  private renderFullImageAndCanvas(img: ImageItem): void {
    ['image', 'canvas'].forEach(type =>
      this.setMainFullImageOrCanvas(type as ImgOrCanvas, img)
    );
  }

  toggleMainImageOrCanvas(): void {
    const mainImage = document.getElementById('main-image') as HTMLElement;
    const mainCanvas = this.c;

    const showCanvas = this.editable() || !!this.selectedPage;
    if (mainImage) mainImage.style.zIndex = showCanvas ? '5' : '10';
    if (mainCanvas) mainCanvas.style.zIndex = showCanvas ? '10' : '5';
  }


  /* ------------------------------
    MAIN IMAGE DRAWING
  ------------------------------ */
  private setMainFullImageOrCanvas(type: ImgOrCanvas, imgItem: ImageItem): void {
    const mainImage = (document.getElementById('main-image') as HTMLElement).style;
    const mainCanvas =(document.getElementById('main-canvas') as HTMLElement).style;
    
    if (imgItem.url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imgItem.url;
      this.mainImage = img;

      img.onload = () => this.fitAndDrawImage(img, imgItem, type);
      img.onerror = () => console.error('Failed to load image.');

      mainImage.visibility = 'visible';
      mainCanvas.visibility = 'visible';
      return;
    }

    mainImage.visibility = 'hidden';
    mainCanvas.visibility = 'hidden';
  }

  private fitAndDrawImage(
    img: HTMLImageElement,
    imgItem: ImageItem,
    type: ImgOrCanvas
  ): void {
    const { c, ctx } = this;

    const appMain = document.querySelector('app-main') as HTMLElement;
    const appStyle = getComputedStyle(appMain);
    const appRect = appMain.getBoundingClientRect();

    const widthAvail =
      appRect.width -
      (parseFloat(appStyle.paddingLeft) +
        parseFloat(appStyle.paddingRight) +
        parseFloat(appStyle.borderLeftWidth) +
        parseFloat(appStyle.borderRightWidth));

    const heightAvail =
      appRect.height -
      (parseFloat(appStyle.paddingTop) +
        parseFloat(appStyle.paddingBottom) +
        parseFloat(appStyle.borderTopWidth) +
        parseFloat(appStyle.borderBottomWidth));

    const imgRatio = img.width / img.height;
    const appRectRatio = appRect.width / appRect.height;

    c.width = widthAvail;
    c.height = heightAvail;

    imgRatio > appRectRatio
      ? c.height = (img.height / img.width) * c.width
      : c.width = imgRatio * c.height;

    ctx.drawImage(img, 0, 0, c.width, c.height);

    this.currentPages = [];
    this.images()
      .find(img => img._id === imgItem._id)
      ?.pages
      ?.forEach(p => {
        this.currentPages.push(p);
        this.drawSimplePage(p);
      });
    
    if (type === 'image') {
      const lastMainImageItemName = this.mainImageItem()._id;

      this.mainImageItem.set({ ...imgItem, url: c.toDataURL('image/jpeg') });

      if (imgItem._id && lastMainImageItemName && imgItem._id !== lastMainImageItemName && this.imgWasEdited) {
        this.updateImagesByEdited(lastMainImageItemName);
      }
    }
  }

  private dimOutside(p: Page) {
    const { c, ctx } = this;
    
    const [centerX, centerY] = [c.width * p.xc, c.height * p.yc];
    const [width, height] = [c.width * p.width, c.height * p.height];
    const angle = degreeToRadian(p.angle);

    ctx.save();

    ctx.beginPath();
    ctx.rect(0, 0, c.width, c.height);

    ctx.save();

    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    ctx.rect(-width/2, -height/2, width, height);
    ctx.restore();

    ctx.clip('evenodd');

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.restore();
  }

  private drawSimplePage(p: Page): void {
    const { c, ctx } = this;
    
    const [centerX, centerY] = [c.width * p.xc, c.height * p.yc];
    const [width, height] = [c.width * p.width, c.height * p.height];
    
    ctx.save();

    ctx.translate(centerX, centerY);
    ctx.rotate(degreeToRadian(p.angle));

    // Outline
    ctx.strokeStyle = getColor(p) + 'B2';
    ctx.lineWidth = this.pageOutlineWidth;
    ctx.strokeRect(-width / 2 - this.pageOutlineWidth / 2, -height / 2 - this.pageOutlineWidth / 2, width + this.pageOutlineWidth, height + this.pageOutlineWidth);

    ctx.restore();
  }


  /* ------------------------------
    PREV / NEXT IMAGE
  ------------------------------ */    
  showPrevImage(): void {
    if (this.currentIndex() === 0 || !this.displayedImages().length) return;
    this.updateImagesByCurrentPages();
    this.showImage(-1);
    if (this.imgWasEdited) defer(() => {
      this.setDisplayedImages();
      this.showToast('Sken byl přesunut do Upravených.');
    }, 100);
  }

  showNextImage(): void {
    if (this.currentIndex() === this.displayedImages().length - 1 || !this.displayedImages().length) return;
    this.updateImagesByCurrentPages();
    this.showImage(1);
    if (this.imgWasEdited) defer(() => {
      this.setDisplayedImages();
      this.showToast('Sken byl přesunut do Upravených.');
    }, 100);
  }

  markImageOK(): void {
    if (this.currentPages.find(p => p.edited) || this.imgWasEdited || !this.displayedImages().length) return;
    
    this.imgWasEdited = false;
    this.images.update(prev =>
      prev.map(img => img._id === this.mainImageItem()._id
        ? { 
            ...img,
            flags: [],
            pages: this.currentPages.map(p => ({
              ...p,
              flags: []
            }))
          }
        : img
      )
    );

    this.showImage(1);
    this.showToast('Sken byl přesunut do OK.');
    if (this.imgWasEdited) defer(() => this.setDisplayedImages(), 100);
  }

  private showImage(offset: number): void {
    const displayedImages = this.displayedImages();
    const newIndex = ((this.currentIndex() + offset + displayedImages.length) % displayedImages.length);
    this.setMainImage(displayedImages.length !== 1 ? displayedImages[newIndex] : this.emptyImageItem);
    if (displayedImages.length === 1) {
      this.setDisplayedImages();
      this.mainImageItem.set(this.emptyImageItem);
    }
    scrollToSelectedImage();
  }


  /* ------------------------------
    PAGE LOGIC
  ------------------------------ */
  pageIdCursorInside(): string {
    const pos = this.mousePos;
    if (!pos) return '';

    const hits = this.currentPages.filter(p => this.isPointInPage(pos.x, pos.y, p));
    const hit = this.selectedPage && hits.includes(this.selectedPage)
      ? this.selectedPage
      : hits[hits.length === 1 ? 0 : (this.isShiftActive ? 1 : 0)];

    return hit?._id ?? '';
  }

  isPointInPage(x: number, y: number, p: Page): boolean {
    const c = this.c;
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

  hoveringPage(hoveredPageId: string): void {
    this.redrawImage();
    this.currentPages.forEach(p => this.drawPage(p, hoveredPageId));
  }

  updateHoverPage(): void {
    const insidePage = Boolean(this.pageId);
    if (!this.isDragging && !this.isRotating && insidePage) {
      this.pageId = this.pageIdCursorInside();
      this.lastPageCursorIsInside = this.currentPages.find(p => p._id === this.pageId) ?? null;
      this.editable.set(insidePage);
      this.hoveringPage(this.hitPage?._id === this.selectedPage?._id ? this.selectedPage?._id ?? '' : this.pageId);
    }
  }

  computeBounds(xc: number, yc: number, width: number, height: number, angle: number): { 
    left: number,
    right: number,
    top: number,
    bottom: number
  } {
    const rad = degreeToRadian(angle);
    const cw = this.c.width;
    const ch = this.c.height;
    const hw = (width * cw) / 2;
    const hh = (height * ch) / 2;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw,  y: -hh },
      { x: hw,  y: hh  },
      { x: -hw, y: hh  },
    ];
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const rotated = corners.map(pt => ({
      x: xc * cw + pt.x * cos - pt.y * sin,
      y: yc * ch + pt.x * sin + pt.y * cos,
    }));
    const xs = rotated.map(p => p.x);
    const ys = rotated.map(p => p.y);

    return {
      left: Math.min(...xs) / cw,
      right: Math.max(...xs) / cw,
      top: Math.min(...ys) / ch,
      bottom: Math.max(...ys) / ch
    }
  }
  
  drawPage(p: Page, hoveredId?: string): void {
    const { c, ctx } = this;
    
    const [centerX, centerY] = [c.width * p.xc, c.height * p.yc];
    const [width, height] = [c.width * p.width, c.height * p.height];
    const color = getColor(p);
    
    ctx.save();

    ctx.translate(centerX, centerY);
    ctx.rotate(degreeToRadian(p.angle));

    // Outline
    ctx.strokeStyle = p._id === this.selectedPage?._id && this.outlineTransparent
      ? transparentColor
      : color + 'B2';
    ctx.lineWidth = this.pageOutlineWidth;
    ctx.strokeRect(-width / 2 - this.pageOutlineWidth / 2, -height / 2 - this.pageOutlineWidth / 2, width + this.pageOutlineWidth, height + this.pageOutlineWidth);

    // Hover
    if (p._id === hoveredId && this.selectedPage?._id !== p._id) {
      ctx.fillStyle = color + '10';
      ctx.fillRect(-width / 2, -height / 2, width, height);
    }

    // Grid
    if (this.selectedPage?._id === p._id && (
      (this.gridMode() === 'when-rotating' && this.isRotating)
      || this.gridMode() === 'always'
    )) {
      const hw = width / 2;
      const hh = height / 2;
      const left = -hw;
      const top = -hh;
      const right = hw;
      const bottom = hh;

      const spacing = 40;

      ctx.save();
      ctx.beginPath();

      // 1px lines that stay 1px even if you scaled elsewhere (optional, harmless if not scaled)
      const sx = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1;
      ctx.lineWidth = 1 / sx;

      ctx.strokeStyle = gridColor;

      // To make 1px lines crisp on canvas, align to half-pixel in local space.
      // Also ensure the first line starts exactly at the top-left corner.
      const xStart = left + spacing + 0.5;
      const yStart = top + spacing + 0.5;

      // Vertical lines
      for (let x = xStart; x <= right; x += spacing) {
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
      }

      // Horizontal lines
      for (let y = yStart; y <= bottom; y += spacing) {
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }

      ctx.stroke();
      ctx.restore();
    }

    // Corner squares
    if (this.selectedPage?._id === p._id && !this.isDragging) {
      const hw = width / 2;
      const hh = height / 2;

      const corners = [
        { x: -hw, y: -hh },
        { x: hw,  y: -hh },
        { x: hw,  y: hh },
        { x: -hw, y: hh }
      ];

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = p._id === this.selectedPage?._id && this.outlineTransparent
        ? transparentColor
        : color + 'B2';
      ctx.lineWidth = this.pageOutlineWidth - 1;

      for (const c of corners) {
        const offsetX = c.x < 0 ? -this.cornerSize : 0;
        const offsetY = c.y < 0 ? -this.cornerSize : 0;

        ctx.fillRect(c.x + offsetX, c.y + offsetY, this.cornerSize, this.cornerSize);
        ctx.strokeRect(c.x + offsetX, c.y + offsetY, this.cornerSize, this.cornerSize);
      }
    }

    ctx.restore();
  }
  
  addPage(): void {
    if (this.currentPages.length >= this.maxPages || !this.displayedImages().length) return;

    if (this.pageWasEdited) this.updateCurrentPagesWithEdited();
    
    const type = this.currentPages.length && (this.currentPages[0].type === 'left' || this.currentPages[0].type === 'single')
      ? 'right' : 'left';
    const addedPage: Page = {
      _id: `${this.mainImageItem()._id}-${type}`,
      xc: .5,
      yc: .5,
      left: .5 - .2,
      right: .5 + .2,
      top: .5 - .425,
      bottom: .5 + .425,
      width: .4,
      height: .85,
      angle: 0,
      edited: true,
      type: type,
      flags: []
    };
    this.currentPages.push(addedPage);
    
    this.selectedPage = this.currentPages[this.currentPages.length - 1];
    this.imgWasEdited = true;
    this.redrawImage();
    this.currentPages.forEach(p => this.drawPage(p));
    this.toggleMainImageOrCanvas();
  }

  removePage(): void {
    this.currentPages = this.currentPages.filter(p => p !== this.selectedPage);
    this.selectedPage = null;
    this.redrawImage();
    this.currentPages.forEach(p => this.drawPage(p));
    this.updateMainImageItem();
    this.imgWasEdited = true;
  }

  updateCurrentPagesWithEdited(): void {
    this.currentPages = this.currentPages.map(p => p._id === (this.clickedDiffPage ? this.lastSelectedPage : this.selectedPage)?._id
      ? { ...p, edited: true }
      : p
    );
    this.pageWasEdited = false;
  }

  redrawImage(): void {
    const { c, ctx } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    
    if (!this.mainImage) return;
    ctx.drawImage(this.mainImage, 0, 0, c.width, c.height);
    if (this.selectedPage) {
      this.dimOutside(this.selectedPage);
    }
  }

  updateMainImageItemAndImages(): void {
    this.updateMainImageItem();
    this.updateImagesByCurrentPages();
  }

  updateMainImageItem(): void {
    this.mainImageItem.set({ ...this.mainImageItem(), url: this.c.toDataURL('image/jpeg') });
  }

  updateImagesByCurrentPages(): void {
    this.images.update(prev =>
      prev.map(img => img._id === this.mainImageItem()._id
        ? { 
            ...img,
            pages: this.currentPages
          }
        : img
      )
    );
  }

  updateImagesByEdited(imgId: string): void {
    this.images.update(prev =>
      prev.map(img => img._id === imgId
        ? { 
            ...img,
            edited: true
          }
        : img
      )
    );
    this.imgWasEdited = false;
  }


  /* ------------------------------
    DIALOG ACTIONS
  ------------------------------ */
  dialogOpened: boolean = false;
  dialogOpen = signal<boolean>(false);
  dialogTitle = signal<string>('');
  dialogContent = signal<boolean>(false);
  dialogContentType = signal<DialogContentType | null>(null);
  dialogDescription = signal<string | null>(null);
  dialogButtons = signal<DialogButton[]>([]);

  focusMainWrapper(): void {
    defer(() => (document.querySelector('.main-wrapper') as HTMLElement).focus());
  }
  
  openDialog(): void {
    this.dialogOpen.set(true);
    this.dialogOpened = true;
    if (document.activeElement?.className !== 'main-wrapper') this.focusMainWrapper();
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.dialogOpened = false;
  }

  upload(): void {
    console.log('should upload');
  }

  openSettings(): void {
    this.dialogTitle.set('Nastavení');
    this.dialogContent.set(true);
    this.dialogContentType.set('settings');
    this.dialogDescription.set(null);
    this.dialogButtons.set([
      { 
        label: 'Reset',
        action: () => {
          this.gridRadio.set('when-rotating');
          this.gridMode.set('when-rotating');
          localStorage.setItem('gridMode', 'when-rotating');
        }
      },
      {
        label: 'Uložit',
        primary: true,
        action: () => {
          const gridRadio = this.gridRadio();
          this.gridMode.set(gridRadio);
          localStorage.setItem('gridMode', gridRadio);
          this.showToast('Nastavení bylo uloženo.', { type: 'success' });
        }
      }
    ]);

    this.openDialog();
  }

  openShortcuts(): void {
    this.dialogTitle.set('Klávesové zkratky');
    this.dialogContent.set(true);
    this.dialogContentType.set('shortcuts');
    this.dialogDescription.set(null);
    this.dialogButtons.set([]);

    this.openDialog();
  }

  openResetDoc(): void {
    this.dialogTitle.set('Opravdu chcete resetovat změny dokumentu?');
    this.dialogContent.set(false);
    this.dialogContentType.set(null);
    this.dialogDescription.set('Reset změn se týká celého dokumentu.');
    this.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Resetovat celý dokument',
        primary: true,
        destructive: true,
        action: () => this.resetDoc()
      }
    ]);

    this.openDialog();
  }

  openResetScan(): void {
    this.dialogTitle.set('Opravdu chcete resetovat změny skenu?');
    this.dialogContent.set(false);
    this.dialogContentType.set(null);
    this.dialogDescription.set('Reset změn se týká aktuálního skenu.');
    this.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Resetovat změny skenu',
        primary: true,
        destructive: true,
        action: () => this.resetScan()
      }
    ]);

    this.openDialog();
  }

  openFinish(): void {
    this.dialogTitle.set('Opravdu chcete dokončit proces?');
    this.dialogContent.set(false);
    this.dialogContentType.set(null);
    this.dialogDescription.set(null);
    this.dialogButtons.set([
      { label: 'Ne, zrušit' },
      {
        label: 'Ano, dokončit',
        primary: true,
        action: () => this.finishEverything()
      }
    ]);

    this.openDialog();
  }


  /* ------------------------------
    TOAST MESSAGES
  ------------------------------ */
  toasts = signal<Toast[]>([]);
  toastDuration: number = 3000;
  
  showToast(message: string, opts?: { type?: ToastType; duration?: number }): string {
    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      message,
      type: opts?.type ?? 'info',
      duration: opts?.duration ?? this.toastDuration,
    };

    this.toasts.update((prev) => [...prev, toast]);
    window.setTimeout(() => this.dismissToast(id), toast.duration);

    return id;
  }

  dismissToast(id: string) {
    this.toasts.update((prev) => prev.filter((t) => t.id !== id));
    this.focusMainWrapper();
  }

  clearAllToasts() {
    this.toasts.set([]);
  }


  // TO DO: REFACTOR!
  /* ------------------------------
    KEYBOARD SHORTCUTS
  ------------------------------ */
  private isHandledKey(key: string): boolean {
    return [
      '+', 'ě', 'Ě', '1', '2',                              // Select left / right page OR + Alt / Cmd = filters number of pages
      'Escape',                                             // Unselect page
      'Backspace', 'Delete',                                // Remove page
      'p', 'P', 'a', 'A',                                   // Add page
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',    // Drag selected page x, y by 1; not selected prev/next scan
      'PageDown', 'PageUp',                                 // (+ PageUp / PageDown)
      'm', 'M', 'g', 'G',                                   // Mřížka / grid
      'o', 'O',                                             // Obrys / outline
      'Enter',                                              // Sken je OK, + control/cmd = dokončit
      'r', 'R',                                             // + control/cmd = reset změn skenu; + control/cmd + shift = reset změn dokumentu
      'F1', 'F2', 'F3', 'F4',                               // Filters
      'Shift',                                              // 1 -> 10
      'Control', 'Meta',                                    // + arrows = change width / height by 1
      'Alt',                                                // + control/cmd + arrows = rotate by 1
      'k', 'K'                                              // Shortcuts
    ].includes(key);
  }

  onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    if (!this.isHandledKey(key) || (event.target as HTMLElement).tagName === 'INPUT') return;
    event.preventDefault();
    event.stopPropagation();

    // Update hover page
    if (key === 'Shift') {
      this.isShiftActive = true;
      this.updateHoverPage();
    }

    // Select left / right page OR Filters number of pages
    if ((key === '+' || key === 'ě' || key === 'Ě' || key === '1' || key === '2') && !event.ctrlKey && !this.dialogOpen()) {
      if (event.altKey || event.metaKey) {
        const filter = ['+', '1'].includes(key) ? 'single' : 'double';
        this.selectedFilter = filter;
        localStorage.setItem('filter', this.selectedFilter);
        this.switchFilter(this.selectedFilter);
        return;
      }
      
      if (this.pageWasEdited) this.updateCurrentPagesWithEdited();
      this.lastSelectedPage = this.selectedPage;
      const isLeftKey = key === '+' || key === '1';
      const targetTypes = isLeftKey ? new Set(['left', 'single']) : new Set(['right']);
      this.selectedPage = this.currentPages.find(p => targetTypes.has(p.type)) ?? null;
      this.clickedDiffPage = this.lastSelectedPage && this.selectedPage && this.lastSelectedPage !== this.selectedPage;
      this.lastPageCursorIsInside = this.selectedPage;
      this.editable.set(true);
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
      this.toggleMainImageOrCanvas();
      this.updateMainImageItem();
    }

    // Unselect page
    if (key === 'Escape') {
      if (this.dialogOpen()) {
        this.dialogOpen.set(false);
        this.dialogOpened = false;
        if (this.dialogTitle() === 'Nastavení') this.gridRadio.set(this.gridMode());
        return;
      }
      
      if (this.pageWasEdited) this.updateCurrentPagesWithEdited();
      this.lastSelectedPage = this.selectedPage;
      this.selectedPage = null;
      this.lastPageCursorIsInside = null;
      this.editable.set(false);
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
      this.updateMainImageItem();
      this.toggleMainImageOrCanvas();
    }

    // Remove selected page
    if (['Backspace', 'Delete'].includes(key) && !this.dialogOpen() && this.selectedPage) this.removePage();
    
    // Add page
    if (['p', 'P', 'a', 'A'].includes(key) && !this.dialogOpen() && this.currentPages.length < this.maxPages) this.addPage();

    // Change grid mode
    if (['m', 'M', 'g', 'G'].includes(key) && this.selectedPage &&!this.dialogOpen()) {
      this.gridMode.set(!this.isRotating
        ? this.gridMode() === 'always' ? 'when-rotating' : 'always'
        : this.gridMode() === 'never' ? 'when-rotating' : 'never');
      this.gridRadio.set(this.gridMode());
      localStorage.setItem('gridMode', this.gridMode());
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    };

    // Outline transparency
    if (['o', 'O'].includes(key) && this.selectedPage && !this.dialogOpen()) {
      this.outlineTransparent = !this.outlineTransparent;
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    }

    // Prev/next scan
    if (((['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key) && !this.selectedPage) || ['PageDown', 'PageUp'].includes(key)) && !this.dialogOpen()) {
      const prevKeys = new Set(['PageUp', 'ArrowLeft', 'ArrowUp']);
      const nextKeys = new Set(['PageDown', 'ArrowRight', 'ArrowDown']);

      const isAllowedArrow = !this.selectedPage && (prevKeys.has(key) || nextKeys.has(key));
      const isPageKey = key === 'PageUp' || key === 'PageDown';

      if (isPageKey || isAllowedArrow) prevKeys.has(key) ? this.showPrevImage() : this.showNextImage();
    }

    // Drag/move page
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key) && this.selectedPage && !event.altKey && !event.ctrlKey && !event.metaKey &&!this.dialogOpen()) {
      const start = this.selectedPage;
      const isHorizontal = ['ArrowLeft', 'ArrowRight'].includes(key);
      const sign = ['ArrowRight','ArrowDown'].includes(key) ? 1 : -1;

      const delta = this.increment * sign * (event.shiftKey ? 10 : 1);

      const axis = isHorizontal
        ? { c: 'xc' as const, min: 'left' as const, max: 'right' as const }
        : { c: 'yc' as const, min: 'top' as const, max: 'bottom' as const };

      let newC = start[axis.c] + delta;
      let newMin = start[axis.min] + delta;
      let newMax = start[axis.max] + delta;

      if (newMin < 0) {
        const offset = -newMin;
        newC += offset;
        newMax += offset;
        newMin = 0;
      }
      if (newMax > 1) {
        const offset = newMax - 1;
        newC -= offset;
        newMin -= offset;
        newMax = 1;
      }

      const updatedPage: Page = {
        ...start,
        [axis.c]: newC,
        [axis.min]: newMin,
        [axis.max]: newMax
      };

      this.pageWasEdited = true;
      this.imgWasEdited = true;
      this.selectedPage = updatedPage;
      this.lastSelectedPage = updatedPage;
      this.currentPages = this.currentPages.map(p =>p._id === updatedPage._id ? updatedPage : p);

      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    }

    // Change page width / height
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key) && this.selectedPage && !this.dialogOpen()
      && (event.ctrlKey || event.metaKey) && !event.altKey
    ) {
      if (['ArrowLeft', 'ArrowRight'].includes(key)) {
        const cw = this.c.width;
        const ch = this.c.height;
        const ratio = cw / ch;
        const inverseRatio = ch / cw;
        
        const page = this.selectedPage;
        const lastWidth = page.width;
        const sign = key === 'ArrowRight' ? 1 : -1;
        const delta = this.increment * sign * (event.shiftKey ? 10 : 1);
        let value = lastWidth + delta;

        const handleAligned = (isHorizontal: boolean, reverse: boolean) => {
          value = clamp(value, 0, isHorizontal
            ? reverse ? page.right : 1 - page.left
            : (reverse ? page.bottom : (1 - page.top)) * inverseRatio);
          
          if (isHorizontal) {
            page.xc = value === 0 ? page.left : page.xc + delta / 2;
            reverse
              ? page.left = clamp(value === 0 ? page.right : page.left + delta)
              : page.right = clamp(value === 0 ? page.left : page.right + delta);
          } else {
            page.yc = value === 0 ? page.top : page.yc + (delta / 2) * ratio;
            reverse
              ? page.top = clamp(value * ratio >= page.bottom ? 0 : page.top + delta * ratio)
              : page.bottom = clamp(page.bottom + delta * ratio);
          }

          page.width = value;
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

          value = clamp(value);
          const rad = degreeToRadian(o.baseAngle);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const toRight = o.signX > 0;
          const toBottom = o.signY > 0;
          const goniom = toRight ? cos : sin;
          const inverseGoniom = toRight ? sin : cos;

          const pageWidthOriginal = page.width;
          const pageLeftOriginal = page.left;
          const pageRightOriginal = page.right;
          const pageTopOriginal = page.top;
          const pageBottomOriginal = page.bottom;

          const dW = delta;
          const limitSide = toRight ? 'right' : 'left';
          const reverseLimitSide = toRight ? 'left' : 'right';
          let newSide = page[limitSide] + dW * (toRight ? cos : -sin);
          page[limitSide] = value === 0 ? page[reverseLimitSide] + Math.sin(degreeToRadian(Math.abs(page.angle))) * page.height * inverseRatio * (toRight ? 1 : -1) : newSide;
          let dX = (dW / 2) * goniom;
          
          page.width = value;
          let adjustedDeltaWidth = dW;
          let adjustedDeltaX = dX;

          if (toRight ? newSide > 1 : newSide < 0) {
            page.width = pageWidthOriginal + ((toRight ? 1 - pageRightOriginal : pageLeftOriginal) / goniom);
            page[limitSide] = toRight ? 1 : 0;
            adjustedDeltaWidth = page.width - lastWidth;
            adjustedDeltaX = (adjustedDeltaWidth / 2) * goniom;
          }

          let deltaY = (adjustedDeltaWidth / 2) * inverseGoniom;
          let adjustedDeltaY = deltaY;
          const secondLimitSide = toBottom ? 'bottom' : 'top';
          const secondReverseLimitSide = toBottom ? 'top' : 'bottom';
          let secondNewSide = page[secondLimitSide] + adjustedDeltaWidth * inverseGoniom * ratio * o.signY;
          page[secondLimitSide] = value === 0 ? page[secondReverseLimitSide] + Math.cos(degreeToRadian(Math.abs(page.angle))) * page.height * (toBottom ? 1 : -1) : secondNewSide;

          if (toBottom ? secondNewSide > 1 : secondNewSide < 0) {
            page.width = pageWidthOriginal + ((toBottom ? (1 - pageBottomOriginal) : pageTopOriginal) / inverseGoniom) * inverseRatio;
            page[secondLimitSide] = toBottom ? 1 : 0;
            adjustedDeltaWidth = page.width - lastWidth;
            adjustedDeltaX = (adjustedDeltaWidth / 2) * goniom;
            adjustedDeltaY = (adjustedDeltaWidth / 2) * inverseGoniom;
            toRight
              ? page.right = pageRightOriginal + adjustedDeltaWidth * cos
              : page.left = pageLeftOriginal - adjustedDeltaWidth * sin;
          }

          page.xc = (page.left + page.right) / 2;
          page.yc = (page.top + page.bottom) / 2;
          
        };

        // --- Dispatch by angle ---
        switch (page.angle) {
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
            handleRotated(page.angle);
            break;
        }
      }

      if (['ArrowUp', 'ArrowDown'].includes(key)) {
        const cw = this.c.width;
        const ch = this.c.height;
        const ratio = cw / ch;
        const inverseRatio = ch / cw;
        
        const page = this.selectedPage;
        const lastHeight = page.height;
        const sign = key === 'ArrowDown' ? 1 : -1;
        const delta = this.increment * sign * (event.shiftKey ? 10 : 1);
        let value = lastHeight + delta;

        const handleAlignedHeight = (isHorizontal: boolean, reverse: boolean) => {
          value = clamp(value, 0, isHorizontal
            ? reverse ? page.bottom : 1 - page.top
            : (reverse ? page.right : (1 - page.left)) * ratio);
          
          if (isHorizontal) {
            page.yc = value === 0 ? page.top : page.yc + delta / 2;
            reverse
              ? page.top = clamp(value === 0 ? page.bottom : page.top + delta)
              : page.bottom = clamp(value === 0 ? page.top : page.bottom + delta);
          } else {
            page.xc = value === 0 ? page.left : page.xc + (delta / 2) * inverseRatio;
            reverse
              ? page.left = clamp(value * inverseRatio >= page.right ? 0 : page.left + delta * inverseRatio)
              : page.right = clamp(page.right + delta * inverseRatio);
          }

          page.height = value;
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

          value = clamp(value);
          const rad = degreeToRadian(o.baseAngle);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const toRight = o.signX > 0;
          const toBottom = o.signY > 0;
          const goniom = toRight ? cos : sin;
          const inverseGoniom = toRight ? sin : cos;

          const pageHeightOriginal = page.height;
          const pageLeftOriginal = page.left;
          const pageRightOriginal = page.right;
          const pageTopOriginal = page.top;
          const pageBottomOriginal = page.bottom;

          const dH = delta;
          const limitSide = toBottom ? 'bottom' : 'top';
          const reverseLimitSide = toBottom ? 'top' : 'bottom';
          let newSide = page[limitSide] + dH * goniom * o.signY;
          page[limitSide] = value === 0 ? page[reverseLimitSide] + Math.sin(degreeToRadian(Math.abs(page.angle))) * page.width * ratio * (toBottom ? 1 : -1) : newSide;
          let dY = (dH / 2) * goniom;
          
          page.height = value;
          let adjustedDeltaHeight = dH;
          let adjustedDeltaY = dY;

          if (toBottom ? newSide > 1 : newSide < 0) {
            page.height = pageHeightOriginal + ((toBottom ? 1 - pageBottomOriginal : pageTopOriginal) / goniom);
            page[limitSide] = toBottom ? 1 : 0;
            adjustedDeltaHeight = page.height - lastHeight;
            adjustedDeltaY = (adjustedDeltaHeight / 2) * goniom;
          }

          let deltaX = (adjustedDeltaHeight / 2) * inverseGoniom;
          let adjustedDeltaX = deltaX;
          const secondLimitSide = toRight ? 'right' : 'left';
          const secondReverseLimitSide = toRight ? 'left' : 'right';
          let secondNewSide = page[secondLimitSide] + adjustedDeltaHeight * inverseGoniom * inverseRatio * o.signX;
          page[secondLimitSide] = value === 0 ? page[secondReverseLimitSide] + Math.cos(degreeToRadian(Math.abs(page.angle))) * page.width * (toRight ? 1 : -1) : secondNewSide;

          if (toRight ? secondNewSide > 1 : secondNewSide < 0) {
            page.height = pageHeightOriginal + ((toRight ? (1 - pageRightOriginal) : pageLeftOriginal) / inverseGoniom) * ratio;
            page[secondLimitSide] = toRight ? 1 : 0;
            adjustedDeltaHeight = page.height - lastHeight;
            adjustedDeltaY = (adjustedDeltaHeight / 2) * goniom;
            adjustedDeltaX = (adjustedDeltaHeight / 2) * inverseGoniom;
            toBottom
              ? page.bottom = pageBottomOriginal + adjustedDeltaHeight * cos
              : page.top = pageTopOriginal - adjustedDeltaHeight * sin;
          }

          page.xc = (page.left + page.right) / 2;
          page.yc = (page.top + page.bottom) / 2;
        };

        // --- Dispatch by angle ---
        switch (page.angle) {
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
            handleRotatedHeight(page.angle);
            break;
        }
      }

      this.pageWasEdited = true;
      this.imgWasEdited = true;
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    }

    // Rotate
    if (
      ['ArrowUp', 'ArrowDown'].includes(key) && this.selectedPage && !this.dialogOpen()
      && (event.ctrlKey || event.metaKey) && event.altKey
    ) {
      const page = this.selectedPage;
      const sign = ['ArrowRight', 'ArrowUp'].includes(key) ? 1 : -1;
      const delta = this.incrementAngle * sign * (event.shiftKey ? 10 : 1);
      const value = page.angle + delta;
      const newAngle = clamp(value, -45, 45);

      const canRotatePage = (page: Page, newAngle: number): boolean => {
        const bounds = this.computeBounds(page.xc, page.yc, page.width, page.height, newAngle);
        return (
          bounds.left >= 0 &&
          bounds.right <= 1 &&
          bounds.top >= 0 &&
          bounds.bottom <= 1
        );
      }

      this.rotationDirection = Math.sign((newAngle - page.angle) || newAngle);
      if (canRotatePage(page, newAngle)) {
        page.angle = newAngle;
      } else {
        const step = this.rotationDirection * (0.1 ** this.decimals);
        let tempAngle = page.angle;
        while (canRotatePage(page, tempAngle + step)) {
          tempAngle += step;
        }
        page.angle = tempAngle;
      }

      const bounds = this.computeBounds(page.xc, page.yc, page.width, page.height, page.angle);

      page.left = bounds.left;
      page.right = bounds.right;
      page.top = bounds.top;
      page.bottom = bounds.bottom;

      this.pageWasEdited = true;
      this.imgWasEdited = true;
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    }
    if ( // Is rotating ON
      (((event.ctrlKey || event.metaKey) && key === 'Alt') || (['Control', 'Meta'].includes(key) && event.altKey))
      && this.selectedPage && !this.dialogOpen()
    ) {
      this.isRotating = true;
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    }

    // Sken je OK
    if (key === 'Enter' && !event.ctrlKey && !event.metaKey && !this.dialogOpen()) this.markImageOK();

    // Dokončit
    if (key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      if (!this.dialogOpen()) {
        this.openFinish();
        return;
      }
      
      switch (this.dialogTitle()) {
        case 'Nastavení':
          const gridRadio = this.gridRadio();  
          this.gridMode.set(gridRadio);
          localStorage.setItem('gridMode', gridRadio);
          break;
        case 'Opravdu chcete resetovat změny dokumentu?':
          this.resetDoc();
          break;
        case 'Opravdu chcete resetovat změny skenu?':
          this.resetScan();
          break;
        case 'Opravdu chcete dokončit proces?':
          this.finishEverything();
          break;
      }

      this.closeDialog();
    };

    // Reset změn dokumentu a skenu
    {
      if (
        !this.dialogOpen() &&
        ((key === 'R' && event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey)
        || (key === 'R' && event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey))
      ) {
        this.openResetDoc();
      } else if (
        !this.dialogOpen() &&
        ((key === 'r' && event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
        || (key === 'r' && event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey))
      ) {
        this.openResetScan();
      }
    }

    // Switch filter
    if (['F1', 'F2', 'F3', 'F4'].includes(key) && !this.dialogOpen()) {
      const filterByKey: { [filter: string]: string } = {
        F1: 'all',
        F2: 'flagged',
        F3: 'edited',
        F4: 'ok'
      };

      const filter = filterByKey[key];
      if (filter) {
        this.selectedFilter = filter;
        localStorage.setItem('filter', this.selectedFilter);
        this.switchFilter(this.selectedFilter);
      }
    }

    // Toggle shortcuts
    if (['k', 'K'].includes(key)) {
      if (this.dialogOpen() && this.dialogTitle() === 'Klávesové zkratky') {
        this.dialogOpen.set(false);
        this.dialogOpened = false;
        return;
      }

      this.openShortcuts();
    };
  }

  onKeyUp(event: KeyboardEvent): void {
    const key = event.key;
    if (!['Shift', 'Control', 'Meta', 'Alt'].includes(key) || (event.target as HTMLElement).tagName === 'INPUT') return;
    
    // Change hover
    if (key === 'Shift') {
      this.isShiftActive = false;
      this.updateHoverPage();
    }

    // Is rotating OFF
    if (
      (((event.ctrlKey || event.metaKey) && key === 'Alt') || (['Control', 'Meta'].includes(key) && event.altKey))
      && this.selectedPage && !this.dialogOpen()
    ) {
      this.isRotating = false;
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    }
  }
}
