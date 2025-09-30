import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ImageItem, Transformation } from '../app.types';
import { Observable } from 'rxjs';
import { serverBaseUrl } from '../app.config';
import { defer, degreeToRadian, getImageUrl } from '../utils/utils';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);

  // Previews
  images = signal<ImageItem[]>([]);
  flaggedImages = computed<ImageItem[]>(() => this.images().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.low_confidence && !img.bad_sides_ratio));

  croppedImages = signal<ImageItem[]>([]);
  flaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => !img.low_confidence && !img.bad_sides_ratio));
  // notFlaggedCroppedImages: HTMLImageElement[] = [];

  transformations = signal<Transformation[]>([]);
  flaggedTransformations = computed<Transformation[]>(() => this.transformations().filter(t => t.low_confidence || t.bad_sides_ratio));
  notFlaggedTransformations = computed<Transformation[]>(() => this.transformations().filter(t => !t.low_confidence && !t.bad_sides_ratio));

  confidenceThreshold: number = .9;
  sideRatioThreshold: number = .1;
  avgSideRatio: number = 0;

  toggledMore: boolean = false;

  loading: boolean = false;

  // Main
  editable = signal<boolean>(false);
  modes: string[] = ['final-single', 'final-full'];
  mode = signal<string>(this.modes[1]);
  lastMode: string = '';
  mainImageItem = signal<ImageItem>({ url: 'https://media.tenor.com/WX_LDjYUrMsAAAAi/loading.gif' });
  leftColor: string = '#00BFFF';
  rightColor: string = '#FF10F0';

  fetchImages(): Observable<ImageItem[]> {
    return this.http.get<ImageItem[]>(`${serverBaseUrl}/api/images`);
  }

  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${serverBaseUrl}/api/transformations`);
  }

  setMainImage(img: ImageItem): void {
    this.mode() === 'final-full'
      ? this.setMainFinalFullImage(img)
      : this.mainImageItem.set(img);
  }

  setCroppedImgs(tfs: Transformation[]): void {
    this.loading = true;    

    const promisesCroppedImages = this.getPromisesImages(tfs);
    Promise.all(promisesCroppedImages).then((imgs: ImageItem[]) => { 
      this.croppedImages.set(imgs);
      if (this.mode() === 'final-single') this.mainImageItem.set(this.flaggedCroppedImages()[0]);
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
          ctx.rotate(angle);
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

  private setMainFinalFullImage(imgItem: ImageItem): void {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgItem.url ?? '';

    img.onload = () => {
      const appMain = (document.querySelector('app-main') as HTMLElement);
      const appMainStyle = getComputedStyle(appMain);
      c.width = appMain.getBoundingClientRect().width - parseFloat(appMainStyle.paddingLeft) - parseFloat(appMainStyle.paddingRight) - parseFloat(appMainStyle.borderLeftWidth) - parseFloat(appMainStyle.borderRightWidth);;
      c.height = (img.height / img.width) * c.width;

      ctx.drawImage(img, 0, 0, c.width, c.height);
      this.transformations().filter(t => t.image_path === imgItem.name).map(t => this.drawRectangle(ctx, c.width, c.height, t));

      this.mainImageItem.set({ ...imgItem, url: c.toDataURL('image/jpeg') });
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
    ctx.rotate(-angle);

    ctx.fillStyle = (t.crop_part === 1 ? this.leftColor : this.rightColor) + '10';
    ctx.strokeStyle = t.crop_part === 1 ? this.leftColor : this.rightColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
