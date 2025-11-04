import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { AvgRect, ImageItem, Rect, Transformation } from '../app.types';
import { Observable } from 'rxjs';
import { books } from '../app.config';
import { degreeToRadian, findFirstMissing, getImageUrl } from '../utils/utils';
import { EnvironmentService } from './environment.service';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);
  private envService = inject(EnvironmentService);
  
  private get serverBaseUrl(): string {
    // because envService might not be initialized at construction time
    return this.envService.get('serverBaseUrl') as string;
  }

  // ---------- STATE ----------
  books: string[] = books;
  modes: string[] = ['single', 'full'];

  book = signal<string>(books[2]);
  mode = signal<string>(this.modes[0]);
  editable = signal<boolean>(false);

  images = signal<ImageItem[]>([]);
  displayedImages = signal<ImageItem[]>([]);
  croppedImages = signal<ImageItem[]>([]);
  originalImages = signal<ImageItem[]>([]);
  originalTransformations = signal<Transformation[]>([]);

  mainImageItem = signal<ImageItem>({ url: 'https://media.tenor.com/WX_LDjYUrMsAAAAi/loading.gif' });

  c!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  mainImage: HTMLImageElement | null = null;
  lastBook: string = '';
  lastMode: string = '';
  loading: boolean = false;

  currentRects: Rect[] = [];
  shouldUpdateCroppedImages: boolean = false;
  selectedRect: Rect | null = null;
  lastSelectedRect: Rect | null = null;
  lastRectCursorIsInside: Rect | null = null;
  isDragging: boolean = false;
  mouseDownCurPos: { x: number, y: number } = { x: -1, y: -1 };
  startRectPos: { x: number, y: number } = { x: -1, y: -1 };

  leftColor: string = '#00BFFF';
  rightColor: string = '#FF10F0';
  confidenceThreshold: number = .9;
  sideRatioThreshold: number = .02;
  avgSideRatio: number = 0;
  maxRects: number = 2;
  avgRect!: AvgRect;
  toggledMore: boolean = false;


  // ---------- DERIVED STATE ----------
  flaggedImages = computed<ImageItem[]>(() => this.images().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.low_confidence && !img.bad_sides_ratio));
  editedImages = computed<ImageItem[]>(() => this.images().filter(img => img.custom));
  flaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => !img.low_confidence && !img.bad_sides_ratio));
  customCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => img.custom));


  // ---------- INITIAL FETCHING ----------
  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${this.serverBaseUrl}/${this.book()}/transformations.json`);
  }

  setCroppedImgs(tfs: Transformation[]): void {
    this.loading = true;
    Promise.all(this.buildCroppedImagePromises(tfs)).then((imgs: ImageItem[]) => { 
      this.croppedImages.set(imgs);
      if (this.mode() === 'single') {
        const [firstFlagged] = this.flaggedCroppedImages();
        if (firstFlagged) this.setMainImage(firstFlagged);
      }
      this.loading = false;
    });
  }

  private buildCroppedImagePromises(tfs: Transformation[]): Promise<ImageItem>[] {
    return tfs.map(t => {
      return new Promise<ImageItem>(resolve => {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        if (!ctx) return resolve({});

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = getImageUrl(this.serverBaseUrl, t.image_path);

        img.onload = () => {
          const centerX = t.x_center * img.width;
          const centerY = t.y_center * img.height;
          const angle = degreeToRadian(t.angle);

          c.width = t.width * img.width;
          c.height = t.height * img.height;

          ctx.save();
          ctx.translate(c.width / 2, c.height / 2);
          ctx.rotate(-angle);
          ctx.drawImage(img, -centerX, -centerY);
          ctx.restore();

          resolve({
            name: t.image_path,
            url: c.toDataURL('image/jpeg'),
            crop_part: t.crop_part,
            low_confidence: t.low_confidence,
            bad_sides_ratio: t.bad_sides_ratio,
            custom: false
          });
        };

        img.onerror = () => console.error('Failed to load image.');
      });
    });
  }


  // ---------- MAIN IMAGE LOGIC ----------
  setMainImage(img: ImageItem): void {
    if (this.shouldUpdateCroppedImages) {
      this.updateCroppedImages(this.mainImageItem());
    }
    
    this.selectedRect = null;
    this.editable.set(false);
    this.toggleMainImageOrCanvas();
    if (this.mode() === 'full') {
      this.renderFullImageAndCanvas(img)
    } else {
      this.mainImageItem.set(img);
    }
  }

  private renderFullImageAndCanvas(img: ImageItem): void {
    ['image', 'canvas'].forEach(type =>
      this.setMainFullImageOrCanvas(type as 'image' | 'canvas', img)
    );
  }

  toggleMainImageOrCanvas(): void {
    const mainImage = document.getElementById('main-image') as HTMLElement;
    const mainCanvas = this.c;

    const showCanvas = this.editable() || !!this.selectedRect;
    if (mainImage) mainImage.style.zIndex = showCanvas ? '5' : '10';
    if (mainCanvas) mainCanvas.style.zIndex = showCanvas ? '10' : '5';
  }


  // ---------- FULL IMAGE DRAWING ----------
  private setMainFullImageOrCanvas(type: 'image' | 'canvas', imgItem: ImageItem): void {
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
    type: 'image' | 'canvas'
  ): void {
    const { c, ctx } = this;
    if (!ctx) return;
    
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
    this.currentRects = [];

    this.images()
      .find(img => img.name === imgItem.name)
      ?.rects
      ?.forEach(r => {
        this.currentRects.push(r);
        this.drawRectangle(r);
      });
    
    if (type === 'image') this.mainImageItem.set({ ...imgItem, url: c.toDataURL('image/jpeg') });
  }

  private drawRectangle(r: Rect): void {
    const { c, ctx } = this;
    if (!ctx) return;
    
    const [centerX, centerY] = [c.width * r.x_center, c.height * r.y_center];
    const [width, height] = [c.width * r.width, c.height * r.height];
    const angle = degreeToRadian(r.angle);
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    ctx.fillStyle = r.color + '10';
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
  }


  // ---------- RECTANGLE LOGIC ----------
  rectIdCursorInside(e: MouseEvent): string {
    const mainElement = document.getElementById(this.editable() ? 'main-canvas' : 'main-image') as HTMLElement;
    if (!mainElement) return '';

    const rect = mainElement.getBoundingClientRect();
    const [x, y] = [e.clientX - rect.left, e.clientY - rect.top];

    const hit = this.selectedRect && this.currentRects.filter(r => this.isPointInRect(x, y, r)).includes(this.selectedRect)
      ? this.selectedRect
      : this.currentRects.find(r => this.isPointInRect(x, y, r));
    
    return hit?.id ?? '';
  }

  private isPointInRect(x: number, y: number, r: Rect): boolean {
    const c = this.c;
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

  hoveringRect(hoveredRectId: string): void {
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r, hoveredRectId));
  }

  private drawRect(c: HTMLCanvasElement, ctx: CanvasRenderingContext2D, r: Rect, hoveredId?: string): void {
    const [centerX, centerY] = [c.width * r.x_center, c.height * r.y_center];
    const [width, height] = [c.width * r.width, c.height * r.height];
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(degreeToRadian(r.angle));

    ctx.fillStyle = r.color + '10';
    ctx.fillRect(-width / 2, -height / 2, width, height);

    if (r.id === hoveredId || this.selectedRect?.id === r.id) {
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-width / 2, -height / 2, width, height);
    }

    ctx.restore();
  }

  addRect(): void {
    const cropPart = findFirstMissing(this.currentRects.map(r => r.crop_part));
    const addedRect = {
      id: `${this.mainImageItem().name}-${cropPart}`,
      x_center: .5,
      // x_center: (cropPart * 2 - 1) / (2 * this.maxRects),
      y_center: .5,
      x: .5 - this.avgRect.width / 2,
      y: .5 - this.avgRect.height / 2,
      width: this.avgRect.width,
      height: this.avgRect.height,
      angle: 0,
      crop_part: cropPart,
      color: cropPart === 1 ? this.leftColor : this.rightColor,
      edited: true
    };
    this.currentRects.push(addedRect);
    
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r));
    this.updateMainImageItemAndImages();
    this.selectedRect = this.currentRects[this.currentRects.length - 1];
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r));
    this.shouldUpdateCroppedImages = true;
  }

  removeRect(): void {
    this.currentRects = this.currentRects.filter(r => r !== this.selectedRect);
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r));
    this.updateMainImageItemAndImages();
    this.croppedImages.update(prev => prev.filter(img => `${img.name}-${img.crop_part}` !== this.selectedRect?.id));
    this.selectedRect = null;

  }

  dragRect(e: MouseEvent): void {    
    if (!this.selectedRect) return;

    const { width, height } = this.c;
    this.shouldUpdateCroppedImages = true;

    // Normalized deltas
    const dx = (e.clientX - this.mouseDownCurPos.x) / width;
    const dy = (e.clientY - this.mouseDownCurPos.y) / height;

    const start = this.startRectPos;
    const rect = this.selectedRect;
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
      x: newCx - rect.width / 2,
      y: newCy - rect.height / 2,
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
    this.selectedRect = updatedRect;
    this.lastSelectedRect = updatedRect;
    this.currentRects = this.currentRects.map(r =>
      r.id === updatedRect.id ? updatedRect : r
    );

    // Redraw
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r));
  }

  onRectInputChange(): void {
    let rect = this.selectedRect;
    if (!rect || !this.selectedRect || rect.x === undefined || rect.y === undefined) return;
    if (rect.x < 0) this.selectedRect.x = 0;
    if (rect.y < 0) this.selectedRect.y = 0;
    if (rect.x > 1 - rect.width) {
      console.log('huh');
      this.selectedRect.x = 1 - rect.width;
    }
    if (rect.y > 1 - rect.height) this.selectedRect.y = 1 - rect.height;

    rect = this.selectedRect;
    if (!rect || !this.selectedRect || rect.x === undefined || rect.y === undefined) return;
    console.log(rect.x);
    console.log(rect.y);

    // Recompute center based on x and y
    rect.x_center = rect.x + rect.width / 2;
    rect.y_center = rect.y + rect.height / 2;
    rect.edited = true;

    // Update state (optional depending on your setup)
    this.selectedRect = rect;
    this.lastSelectedRect = rect;
    this.currentRects = this.currentRects.map(r =>
      r.id === rect.id ? rect : r
    );

    // Redraw the canvas
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r));
  }

  private redrawImage(): void {
    const { c, ctx } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    if (this.mainImage) ctx.drawImage(this.mainImage, 0, 0, c.width, c.height);
  }

  updateMainImageItemAndImages(isCustom: boolean = true): void {
    this.mainImageItem.set({ ...this.mainImageItem(), url: this.c.toDataURL('image/jpeg') });
    this.images.update(prev =>
      prev.map(img => img.name === this.mainImageItem().name
        ? { 
            ...img,
            custom: isCustom,
            rects: this.currentRects
          }
        : img
      )
    );
  }

  updateCroppedImages(mainImageItem: ImageItem): void {
    let cropPart = 0;
    const promises = this.currentRects
      .filter(r => r.edited)
      .map(r => {
        cropPart = r.crop_part;
        return new Promise<ImageItem>(resolve => {
          const c = document.createElement('canvas');
          const ctx = c.getContext('2d');
          if (!ctx) return resolve({});

          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = getImageUrl(this.serverBaseUrl, mainImageItem.name ?? '');

          img.onload = () => {
            const centerX = r.x_center * img.width;
            const centerY = r.y_center * img.height;
            const angle = degreeToRadian(r.angle);

            c.width = r.width * img.width;
            c.height = r.height * img.height;

            ctx.save();
            ctx.translate(c.width / 2, c.height / 2);
            ctx.rotate(-angle);
            ctx.drawImage(img, -centerX, -centerY);
            ctx.restore();

            resolve({
              name: mainImageItem.name,
              url: c.toDataURL('image/jpeg'),
              crop_part: r.crop_part,
              custom: true
            });
          };

          img.onerror = () => console.error('Failed to load image.');
        });
    });
    
    this.croppedImages.update(prev => prev
      .filter(img => img.name !== mainImageItem.name || img.crop_part !== cropPart));

    Promise.all(promises).then(imgArr => imgArr.forEach(img => this.croppedImages.update(prev => [...prev, img])));

    this.shouldUpdateCroppedImages = false;
  }


  // ---------- KEYBOARD SHORTCUTS ----------
  onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    if (!this.isHandledKey(key) || (event.target as HTMLElement).tagName === 'INPUT') return;

    switch (key) {
      case 'Backspace':
        if (this.selectedRect) this.removeRect();
        break;
      case 'Delete':
        if (this.selectedRect) this.removeRect();
        break;
      case 'r':
        if (this.currentRects.length < this.maxRects) this.addRect();
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
