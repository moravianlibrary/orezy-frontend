import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ImageItem, ImgOrCanvas, Page, PagePosition } from '../app.types';
import { Observable } from 'rxjs';
import { defer, degreeToRadian, getColor } from '../utils/utils';
import { EnvironmentService } from './environment.service';

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

  images = signal<ImageItem[]>([]);
  displayedImages = signal<ImageItem[]>([]);

  mainImageItem = signal<ImageItem>({ _id: '', url: '', thumbnailUrl: '', edited: false, flags: [], pages: [] });
  imgWasEdited: boolean = false;

  c!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  mainImage: HTMLImageElement | null = null;
  lastBook: string = '';
  lastMode: string = '';
  loadingLeft: boolean = false;
  loadingMain: boolean = false;

  currentPages: Page[] = [];
  selectedPage: Page | null = null;
  lastSelectedPage: Page | null = null;
  lastPageCursorIsInside: Page | null = null;
  isDragging: boolean = false;
  mouseDownCurPos: { x: number, y: number } = { x: -1, y: -1 };
  startPagePos: PagePosition = { xc: -1, yc: -1, left: -1, right: -1, top: -1, bottom: -1 };
  pageWasEdited: boolean = false;
  
  lastLeftInput: number = 0;
  lastTopInput: number = 0;
  lastWidthInput: number = 0;
  lastHeightInput: number = 0;
  lastAngleInput: number = 0;

  pageOutlineWidth: number = 3;
  maxPages: number = 2;
  toggledMore: boolean = false;


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
      if (this.pageWasEdited && this.selectedPage) {
        this.selectedPage.edited = true;
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

    ctx.strokeStyle = color + 'B2';
    ctx.lineWidth = this.pageOutlineWidth;
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    if (p._id === hoveredId && this.selectedPage?._id !== p._id) {
      ctx.fillStyle = color + '10';
      ctx.fillRect(-width / 2, -height / 2, width, height);
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
    this.currentPages = this.currentPages.map(p => p._id === this.selectedPage?._id
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
  onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    if (!this.isHandledKey(key) || (event.target as HTMLElement).tagName === 'INPUT') return;

    switch (key) {
      case 'Backspace':
        if (this.selectedPage) this.removePage();
        break;
      case 'Delete':
        if (this.selectedPage) this.removePage();
        break;
      case 'r':
        if (this.currentPages.length < this.maxPages) this.addPage();
        break;
    }
  }

  private isHandledKey(key: string): boolean {
    return [
      'Backspace', 'Delete',
      'r'
    ].includes(key);
  }
}
