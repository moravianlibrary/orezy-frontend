import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { HitInfo, ImageItem, ImgOrCanvas, MousePos, Page } from '../app.types';
import { catchError, Observable, of } from 'rxjs';
import { defer, degreeToRadian, getColor, scrollToSelectedImage } from '../utils/utils';
import { EnvironmentService } from './environment.service';
import { transparentColor } from '../app.config';

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
  selectedFilter: string = 'flagged';
  editable = signal<boolean>(false);
  dialogOpened: boolean = false;

  images = signal<ImageItem[]>([]);
  originalImages = signal<ImageItem[]>([]);
  displayedImages = signal<ImageItem[]>([]);

  mainImageItem = signal<ImageItem>({ _id: '', url: '', thumbnailUrl: '', edited: false, flags: [], pages: [] });
  imgWasEdited: boolean = false;

  c!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  currentIndex = computed<number>(() => this.displayedImages().findIndex(img => img._id === this.mainImageItem()._id));
  mainImage: HTMLImageElement | null = null;
  lastBook: string = '';
  lastMode: string = '';
  loadingLeft: boolean = false;
  loadingMain: boolean = false;

  pageWasEdited: boolean = false;
  currentPages: Page[] = [];
  selectedPage: Page | null = null;
  lastSelectedPage: Page | null = null;
  clickedDiffPage: boolean | null = null;

  startHit: HitInfo | null = null;

  // Hover
  lastPageCursorIsInside: Page | null = null;

  // Drag
  isDragging: boolean = false;
  dragStartPage: Page | null = null;
  dragStartMouse: MousePos | null = null;
  
  // Rotate
  isRotating: boolean = false;
  rotationStartPage: Page | null = null;
  rotationStartMouseAngle: number = 0;

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
    if (this.imgWasEdited) this.updateImagesByEdited(this.mainImageItem()._id);
    this.updatePages(this.book(), this.images().filter(img => img.edited))
      .subscribe({
        next: () => {
          this.selectedFilter = 'edited';
          this.setDisplayedImages();
        },
        error: (err: Error) => console.error(err)
      })
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

    this.selectedFilter = mainImageItemAfter.edited ? 'edited' : (mainImageItemAfter.flags.length ? 'flagged' : 'ok');
    this.setDisplayedImages();
    this.setMainImage(mainImageItemAfter);
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
      
      this.setDisplayedImages();
      this.setMainImage(this.displayedImages()[0]);
    });
  }


  /* ------------------------------
    DISPLAYED IMAGES (left panel)
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
    }
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

    ctx.strokeStyle = getColor(p) + 'B2';
    ctx.lineWidth = this.pageOutlineWidth;
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.restore();
  }


  /* ------------------------------
    PREV / NEXT IMAGE
  ------------------------------ */    
  showPrevImage(): void {
    if (this.currentIndex() === 0) return;
    this.showImage(-1);
    if (this.imgWasEdited) defer(() => this.setDisplayedImages(), 100);
  }

  showNextImage(): void {
    if (this.currentIndex() === this.displayedImages().length - 1) return;
    this.showImage(1);
    if (this.imgWasEdited) defer(() => this.setDisplayedImages(), 100);
  }

  private showImage(offset: number): void {
    const displayedImages = this.displayedImages();

    if (displayedImages.length === 0) return;

    const newIndex = (this.currentIndex() + offset + displayedImages.length) % displayedImages.length;
    this.setMainImage(displayedImages[newIndex]);

    scrollToSelectedImage();
  }


  /* ------------------------------
    PAGE LOGIC
  ------------------------------ */
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

    ctx.strokeStyle = p._id === this.selectedPage?._id && this.outlineTransparent
      ? transparentColor
      : color + 'B2';
    ctx.lineWidth = this.pageOutlineWidth;
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    // Hover
    if (p._id === hoveredId && this.selectedPage?._id !== p._id) {
      ctx.fillStyle = color + '10';
      ctx.fillRect(-width / 2, -height / 2, width, height);
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
    if (this.currentPages.length >= this.maxPages) return;

    if (this.pageWasEdited) this.updateCurrentPagesWithEdited();
    
    const type = this.currentPages.length && this.currentPages[0].type === 'left' ? 'right' : 'left';
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
    this.redrawImage();
    this.currentPages.forEach(p => this.drawPage(p));
    this.updateMainImageItemAndImages();
    this.imgWasEdited = true;
  }

  removePage(): void {
    this.currentPages = this.currentPages.filter(p => p !== this.selectedPage);
    this.selectedPage = null;
    this.redrawImage();
    this.currentPages.forEach(p => this.drawPage(p));
    this.updateMainImageItemAndImages();
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
    this.mainImageItem.set({ ...this.mainImageItem(), url: this.c.toDataURL('image/jpeg') });
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
    KEYBOARD SHORTCUTS
  ------------------------------ */
  private isHandledKey(key: string): boolean {
    return [
      '+', 'ě', '1', '2',                                   // Select left / right page
      'Escape',                                             // Unselect page
      'Backspace', 'Delete',                                // Remove page
      'p', 'a',                                             // Add page
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',    // drag selected page x, y by 1; not selected prev/next scan (+ PageUp / PageDown)
      'm', 'g',                                             // grid
      'o',                                                  // obrys
      'Enter',                                              // + control = dokončit
      'r', 'z',                                             // + control = reset změn skenu; + control + shift + alt = reset změn dokumentu
      'F1', 'F2', 'F3', 'F4', 'š', 'č', '3', '4',           // filters OR control + 1, 2, 3, 4 / +, ě, š, č
      'Shift',                                              // 1 -> 10
      'Control',                                            // + arrows = change width / height by 1
      'Alt'                                                 // + arrows = rotate by 1
    ].includes(key);
  }

  onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    // console.log(key);
    // console.log(event.code);
    if (!this.isHandledKey(key) || (event.target as HTMLElement).tagName === 'INPUT') return;
    // event.preventDefault();
    // event.stopPropagation();

    // Select left / right page
    if ((key === '+' || key === 'ě' || key === '1' || key === '2') && !event.ctrlKey) {
      if (this.pageWasEdited) this.updateCurrentPagesWithEdited();
      this.lastSelectedPage = this.selectedPage;
      this.selectedPage = this.currentPages.find(p => p.type === ((key === '+' || key === '1') ? 'left' : 'right')) ?? null;
      this.clickedDiffPage = this.lastSelectedPage && this.selectedPage && this.lastSelectedPage !== this.selectedPage;
      this.lastPageCursorIsInside = this.selectedPage;
      this.editable.set(true);
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
      this.toggleMainImageOrCanvas();
    }

    // Unselect page
    if (key === 'Escape') {
      if (this.pageWasEdited) this.updateCurrentPagesWithEdited();
      this.lastSelectedPage = this.selectedPage;
      this.selectedPage = null;
      this.lastPageCursorIsInside = null;
      this.editable.set(false);
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
      this.toggleMainImageOrCanvas();
      this.updateMainImageItemAndImages();
    }

    // Remove selected page
    if (['Backspace', 'Delete'].includes(key)) if (this.selectedPage) this.removePage();
    
    // Add page
    if (['p', 'a'].includes(key)) if (this.currentPages.length < this.maxPages) this.addPage();

    // Outline transparency
    if (key === 'o' && this.selectedPage) {
      this.outlineTransparent = !this.outlineTransparent;
      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    }

    // Prev/next scan
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key) && !this.selectedPage) {      
      if (['ArrowLeft', 'ArrowUp'].includes(key)) {
        this.showPrevImage();
      } else {
        this.showNextImage();
      }
    }

    // Drag/move page
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key) && this.selectedPage && !event.altKey && !event.ctrlKey) {
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

      this.selectedPage = updatedPage;
      this.lastSelectedPage = updatedPage;
      this.currentPages = this.currentPages.map(p =>p._id === updatedPage._id ? updatedPage : p);

      this.redrawImage();
      this.currentPages.forEach(p => this.drawPage(p));
    }

    // Change page width / height
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key) && this.selectedPage && !event.altKey) {
      // TO DO
    }

    // Dokončit
    if (key === 'Enter' && event.ctrlKey) this.finishEverything();




    // Reset změn dokumentu a skenu
    // console.log(key === 'Y');
    if (
      (key === 'r' && event.ctrlKey && event.metaKey && !event.shiftKey && !event.altKey)
      // || (key === 'r' || key === 'z') && event.ctrlKey && event.shiftKey && event.altKey
    ) {
      // event.preventDefault();
      // event.stopPropagation();
      // console.log('resetdoc');
      // this.resetDoc();
    } else if (
      (key === 'r' && event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
      || (key === 'y' && event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
    ) {
      // event.preventDefault();
      // event.stopPropagation();
      // this.resetScan();
    }
  }
}
