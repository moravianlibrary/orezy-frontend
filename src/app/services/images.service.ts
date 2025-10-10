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
  books: string[] = books;
  book = signal<string>(books[2]);
  lastBook: string = '';
  loading: boolean = false;

  // Previews
  images = signal<ImageItem[]>([]);
  flaggedImages = computed<ImageItem[]>(() => this.images().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.low_confidence && !img.bad_sides_ratio));

  croppedImages = signal<ImageItem[]>([]);
  flaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => !img.low_confidence && !img.bad_sides_ratio));
  // notFlaggedCroppedImages: HTMLImageElement[] = [];

  transformations = signal<Transformation[]>([]);
  // flaggedTransformations = computed<Transformation[]>(() => this.transformations().filter(t => t.low_confidence || t.bad_sides_ratio));
  notFlaggedTransformations = computed<Transformation[]>(() => this.transformations().filter(t => !t.low_confidence && !t.bad_sides_ratio));

  confidenceThreshold: number = .9;
  sideRatioThreshold: number = .02;
  avgSideRatio: number = 0;

  toggledMore: boolean = false;

  // Main
  editable = signal<boolean>(false);
  modes: string[] = ['single', 'full'];
  mode = signal<string>(this.modes[1]);
  lastMode: string = '';
  mainImageItem = signal<ImageItem>({ url: 'https://media.tenor.com/WX_LDjYUrMsAAAAi/loading.gif' });
  mainImage: HTMLImageElement | null = null;
  leftColor: string = '#00BFFF';
  rightColor: string = '#FF10F0';
  rects: Rect[] = [];
  selectedRect: Rect | null = null;

  fetchImages(): Observable<ImageItem[]> {
    return this.http.get<any>(`${serverBaseUrl}/${this.book()}/`, { 'responseType': 'text' as 'json' }).pipe(
      map((html: any) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const anchors = Array.from(doc.querySelectorAll('a[href]'));
        const files = anchors
          .map(a => a.getAttribute('href')!)
          .filter(href => href && href !== '../');

        const images = files
          .filter(f => f.toLowerCase().endsWith('.jpg'))
          .map(f => ({
          name: `${this.book()}/` + f,
          url: serverBaseUrl + `/${this.book()}/` + f
        }));

        return images;
      })
    );
  }

  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${serverBaseUrl}/${this.book()}/transformations.json`);
  }

  setCroppedImgs(tfs: Transformation[]): void {
    this.loading = true;

    const promisesCroppedImages = this.getPromisesImages(tfs);
    Promise.all(promisesCroppedImages).then((imgs: ImageItem[]) => { 
      this.croppedImages.set(imgs);
      if (this.mode() === 'single') this.setMainImage(this.flaggedCroppedImages()[0]);
      this.loading = false;
    });
  }

  private getPromisesImages(tfs: Transformation[]): Promise<ImageItem>[] {
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

          const resultImg: ImageItem = {
            name: t.image_path,
            url: c.toDataURL('image/jpeg'),
            crop_part: t.crop_part,
            low_confidence: t.low_confidence,
            bad_sides_ratio: t.bad_sides_ratio
          };

          resolve(resultImg);
        };

        img.onerror = () => { console.error('Failed to load image.') };
      });
    });
  }

  setMainImage(img: ImageItem): void {
    this.editable.set(false);
    this.toggleMainImageOrCanvas();
    if (this.mode() === 'full') {
      this.setMainFullImageOrCanvas('image', img);
      this.setMainFullImageOrCanvas('canvas', img);
      return;
    }
      
    this.mainImageItem.set(img);
  }

  isCursorInsideRect(e: MouseEvent): string {
    const mainImage = document.getElementById(this.editable() ? 'main-canvas' : 'main-image') as HTMLElement;
    const rect = mainImage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY;

    const rectCursorIsInside = this.rects.find(r => {
      const angle = degreeToRadian(r.angle);
      const halfW = r.width / 2;
      const halfH = r.height / 2;

      const dx = x - r.x_center;
      const dy = y - (r.y_center + r.realTop);
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      return (
        localX >= -halfW &&
        localX <= halfW &&
        localY >= -halfH &&
        localY <= halfH
      );
    });
    
    return rectCursorIsInside?.id ?? '';
  }

  toggleMainImageOrCanvas(): void {
    const mainImage = document.getElementById('main-image') as HTMLElement;
    const mainCanvas = document.getElementById('main-canvas') as HTMLElement;

    if (this.editable()) {
      if (mainImage) mainImage.style.zIndex = '5';
      if (mainCanvas) mainCanvas.style.zIndex = '10';
      return;
    }

    if (mainImage) mainImage.style.zIndex = '10';
    if (mainCanvas) mainCanvas.style.zIndex = '5';
  }

  hoveringRect(hoveredRectId: string) {
    const c = document.getElementById('main-canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, c.width, c.height);

    const img = this.mainImage;
    if (img) ctx.drawImage(img, 0, 0, c.width, c.height);

    this.rects.forEach(r => {
      ctx.save();
      ctx.translate(r.x_center, r.y_center);
      ctx.rotate(degreeToRadian(r.angle));

      ctx.fillStyle = (r.crop_part === 1 ? this.leftColor : this.rightColor) + '10';
      ctx.beginPath();
      ctx.rect(-r.width / 2, -r.height / 2, r.width, r.height);
      ctx.fill();

      if (r.id === hoveredRectId) {
        ctx.strokeStyle = r.crop_part === 1 ? this.leftColor : this.rightColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  private setMainFullImageOrCanvas(type: 'image' | 'canvas', imgItem: ImageItem): void {
    const c = document.getElementById('main-canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgItem.url ?? '';
    this.mainImage = img;

    img.onload = () => {
      const appMain = (document.querySelector('app-main') as HTMLElement);
      const appMainStyle = getComputedStyle(appMain);
      c.width = appMain.getBoundingClientRect().width - parseFloat(appMainStyle.paddingLeft) - parseFloat(appMainStyle.paddingRight) - parseFloat(appMainStyle.borderLeftWidth) - parseFloat(appMainStyle.borderRightWidth);
      c.height = (img.height / img.width) * c.width;
      
      ctx.drawImage(img, 0, 0, c.width, c.height);
      this.rects = [];
      this.transformations().filter(t => t.image_path === imgItem.name).map(t => {
        this.rects = [...this.rects, {
          id: t.image_path + String(t.confidence),
          x_center: t.x_center * c.width,
          y_center: t.y_center * c.height,
          width: t.width * c.width,
          height: t.height * c.height,
          realTop: (appMain.getBoundingClientRect().height - c.height) / 2,
          angle: t.angle,
          crop_part: t.crop_part
        }]
        this.drawRectangle(ctx, c.width, c.height, t);
      });

      if (type === 'image') this.mainImageItem.set({ ...imgItem, url: c.toDataURL('image/jpeg') });
    };

    img.onerror = () => { console.error('Failed to load image.') };
  }

  private drawRectangle(ctx: CanvasRenderingContext2D, cWidth: number, cHeight: number, t: Transformation): void {
    const centerX = cWidth * t.x_center;
    const centerY = cHeight * t.y_center;
    const angle = degreeToRadian(t.angle);
    const width = cWidth * t.width;
    const height = cHeight * t.height;
    
    ctx.save();

    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    ctx.fillStyle = (t.crop_part === 1 ? this.leftColor : this.rightColor) + '10';
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    ctx.fill();

    ctx.restore();
  }
}
