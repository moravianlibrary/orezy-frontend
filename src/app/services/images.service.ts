import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ImageItem, Rect, Transformation } from '../app.types';
import { map, Observable } from 'rxjs';
import { books, serverBaseUrl } from '../app.config';
import { degreeToRadian, getImageUrl } from '../utils/utils';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);


  // ---------- STATE ----------
  books: string[] = books;
  modes: string[] = ['single', 'full'];

  book = signal<string>(books[2]);
  mode = signal<string>(this.modes[1]);
  editable = signal<boolean>(false);

  mainImageItem = signal<ImageItem>({ url: 'https://media.tenor.com/WX_LDjYUrMsAAAAi/loading.gif' });
  
  images = signal<ImageItem[]>([]);
  croppedImages = signal<ImageItem[]>([]);
  transformations = signal<Transformation[]>([]);

  mainImage: HTMLImageElement | null = null;
  rects: Rect[] = [];
  selectedRect: Rect | null = null;
  lastRectCursorIsInside: boolean = false;
  lastBook: string = '';
  lastMode: string = '';
  loading: boolean = false;

  leftColor: string = '#00BFFF';
  rightColor: string = '#FF10F0';
  confidenceThreshold: number = .9;
  sideRatioThreshold: number = .02;
  avgSideRatio: number = 0;
  maxRects: number = 2;
  toggledMore: boolean = false;


  // ---------- DERIVED STATE ----------
  flaggedImages = computed<ImageItem[]>(() => this.images().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.low_confidence && !img.bad_sides_ratio));
  flaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => !img.low_confidence && !img.bad_sides_ratio));
  notFlaggedTransformations = computed<Transformation[]>(() => this.transformations().filter(t => !t.low_confidence && !t.bad_sides_ratio));


  // ---------- FETCHING ----------
  fetchImages(): Observable<ImageItem[]> {
    return this.http.get(`${serverBaseUrl}/${this.book()}/`, { responseType: 'text' })
      .pipe(map((html) => this.parseImageList(html)));
  }

  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${serverBaseUrl}/${this.book()}/transformations.json`);
  }

  private parseImageList(html: string): ImageItem[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href'))
      .filter((href): href is string => !!href && href !== '../')
      .filter((f) => f.toLowerCase().endsWith('.jpg'))
      .map((f) => ({
        name: `${this.book()}/${f}`,
        url: `${serverBaseUrl}/${this.book()}/${f}`,
      }));
  }


  // ---------- CROPPED IMAGES ----------
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
      return new Promise<ImageItem>((resolve) => {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        if (!ctx) return resolve({});

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = getImageUrl(t.image_path);

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
            bad_sides_ratio: t.bad_sides_ratio
          });
        };

        img.onerror = () => { console.error('Failed to load image.') };
      });
    });
  }


  // ---------- MAIN IMAGE LOGIC ----------
  setMainImage(img: ImageItem): void {
    this.selectedRect = null;
    this.editable.set(false);
    this.toggleMainImageOrCanvas();
    this.mode() === 'full'
      ? this.renderFullImageAndCanvas(img)
      : this.mainImageItem.set(img);
  }

  private renderFullImageAndCanvas(img: ImageItem): void {
    ['image', 'canvas'].forEach((type) =>
      this.setMainFullImageOrCanvas(type as 'image' | 'canvas', img)
    );
  }

  toggleMainImageOrCanvas(): void {
    const mainImage = document.getElementById('main-image') as HTMLElement;
    const mainCanvas = document.getElementById('main-canvas') as HTMLElement;

    const showCanvas = this.editable() || !!this.selectedRect;
    if (mainImage) mainImage.style.zIndex = showCanvas ? '5' : '10';
    if (mainCanvas) mainCanvas.style.zIndex = showCanvas ? '10' : '5';
  }


  // ---------- RECTANGLE LOGIC ----------
  rectIdCursorInside(e: MouseEvent): string {
    const mainElement = document.getElementById(this.editable() ? 'main-canvas' : 'main-image') as HTMLElement;
    if (!mainElement) return '';

    const rect = mainElement.getBoundingClientRect();
    const [x, y] = [e.clientX - rect.left, e.clientY - rect.top];

    const hit = this.selectedRect && this.rects.filter((r) => this.isPointInRect(x, y, r)).includes(this.selectedRect)
      ? this.selectedRect
      : this.rects.find((r) => this.isPointInRect(x, y, r));
    return hit?.id ?? '';
  }

  private isPointInRect(x: number, y: number, r: Rect): boolean {
    const angle = degreeToRadian(r.angle);
    const [halfW, halfH] = [r.width / 2, r.height / 2];
    const dx = x - r.x_center;
    const dy = y - r.y_center;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    return localX >= -halfW && localX <= halfW && localY >= -halfH && localY <= halfH;
  }

  hoveringRect(hoveredRectId: string): void {
    const c = document.getElementById('main-canvas') as HTMLCanvasElement;
    const ctx = c?.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, c.width, c.height);
    if (this.mainImage) ctx.drawImage(this.mainImage, 0, 0, c.width, c.height);

    this.rects.forEach((r) => this.drawRect(ctx, r, hoveredRectId));
  }

  private drawRect(ctx: CanvasRenderingContext2D, r: Rect, hoveredId: string): void {
    ctx.save();
    ctx.translate(r.x_center, r.y_center);
    ctx.rotate(degreeToRadian(r.angle));

    const color = r.crop_part === 1 ? this.leftColor : this.rightColor;
    ctx.fillStyle = color + '10';
    ctx.fillRect(-r.width / 2, -r.height / 2, r.width, r.height);

    if (r.id === hoveredId || this.selectedRect?.id === r.id) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-r.width / 2, -r.height / 2, r.width, r.height);
    }

    ctx.restore();
  }


  // ---------- FULL IMAGE DRAWING ----------
  private setMainFullImageOrCanvas(type: 'image' | 'canvas', imgItem: ImageItem): void {
    const c = document.getElementById('main-canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgItem.url ?? '';
    this.mainImage = img;

    img.onload = () => this.fitAndDrawImage(c, ctx, img, imgItem, type);

    img.onerror = () => { console.error('Failed to load image.') };
  }

  private fitAndDrawImage(
    c: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    imgItem: ImageItem,
    type: 'image' | 'canvas'
  ): void {
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

    if (img.width / img.height > appRect.width / appRect.height) {
      c.width = widthAvail;
      c.height = (img.height / img.width) * widthAvail;
    } else {
      c.height = heightAvail;
      c.width = (img.width / img.height) * heightAvail;
    }

    ctx.drawImage(img, 0, 0, c.width, c.height);
    this.rects = [];

    this.transformations()
      .filter((t) => t.image_path === imgItem.name)
      .forEach((t) => {
        this.rects.push({
          id: `${t.image_path}-${t.crop_part}`,
          x_center: t.x_center * c.width,
          y_center: t.y_center * c.height,
          width: t.width * c.width,
          height: t.height * c.height,
          realTop: (appRect.height - c.height) / 2,
          angle: t.angle,
          crop_part: t.crop_part,
        });
        this.drawRectangle(ctx, c.width, c.height, t);
      });

    if (type === 'image') this.mainImageItem.set({ ...imgItem, url: c.toDataURL('image/jpeg') });
  }

  private drawRectangle(ctx: CanvasRenderingContext2D, cWidth: number, cHeight: number, t: Transformation): void {
    const [centerX, centerY] = [cWidth * t.x_center, cHeight * t.y_center];
    const [width, height] = [cWidth * t.width, cHeight * t.height];
    const angle = degreeToRadian(t.angle);
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    ctx.fillStyle = (t.crop_part === 1 ? this.leftColor : this.rightColor) + '10';
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
  }
}
