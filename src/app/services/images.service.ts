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

  flaggedCroppedImages: HTMLImageElement[] = [];
  notFlaggedCroppedImages: HTMLImageElement[] = [];

  transformations = signal<Transformation[]>([]);
  flaggedTransformations = computed<Transformation[]>(() => this.transformations().filter(t => t.low_confidence || t.bad_sides_ratio));
  notFlaggedTransformations = computed<Transformation[]>(() => this.transformations().filter(t => !t.low_confidence && !t.bad_sides_ratio));

  confidenceThreshold: number = .9;
  sideRatioThreshold: number = .1;
  avgSideRatio: number = 0;

  toggledMore: boolean = false;

  // Main
  mainImageTransformation: Transformation = this.transformations()[0];
  editable = signal<boolean>(false);
  modes: string[] = ['final-single', 'final-full'];
  mode = signal<string>(this.modes[1]);
  lastMode: string = '';
  leftColor: string = '#00BFFF';
  rightColor: string = '#FF10F0';

  fetchImages(): Observable<ImageItem[]> {
    return this.http.get<ImageItem[]>(`${serverBaseUrl}/api/images`);
  }

  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${serverBaseUrl}/api/transformations`);
  }

  imageItemToTransformation(imageItem: ImageItem): Transformation {
    return this.transformations().filter(t => t.image_path === imageItem.name)[0];
  }

  setMainImage(imgt: Transformation): void {
    this.mainImageTransformation = imgt;

    const mainContainer = document.getElementById('main-container');
    if (!mainContainer) return;
    mainContainer.innerHTML = '';

    switch (this.mode()) {
      case 'final-single':
        document.querySelectorAll('.final-single-flagged-thumb, .final-single-notflagged-thumb').forEach(img => (img as HTMLElement).style.outline = 'none');
        defer(() => {
          this.appendCroppedImgs(mainContainer, this.transformations().filter(t => t.image_path === imgt.image_path && t.confidence === imgt.confidence), 'main');
          defer(() => (document.getElementById(imgt.image_path + '-' + imgt.confidence) as HTMLElement).style.outline = '4px solid #FF10F0', 100);
        });
        break;
      case 'final-full':
        this.getMainFinalFullImage(mainContainer, imgt);
        break;
    }
  }

  loadCroppedImgs(type: 'flagged' | 'notflagged'): void {
    const appender = document.querySelector('.thumbnails-' + type + '-wrapper') as HTMLElement;
    if (!appender || this.mode() !== 'final-single') return;

    this.getCroppedImgs(appender, type === 'flagged' ? this.flaggedTransformations() : this.notFlaggedTransformations(), type).then(imgs => {
      imgs.map(img => appender.appendChild(img));
      type === 'flagged'
        ? this.flaggedCroppedImages = imgs
        : this.notFlaggedCroppedImages = imgs;
    });
  }

  private getCroppedImgs(appender: HTMLElement | null, tfs: Transformation[], type?: 'main' | 'flagged' | 'notflagged'): Promise<HTMLImageElement[]> {
    if (!appender) return Promise.resolve([]);
    
    const promises = tfs.map(t => {
      return new Promise<HTMLImageElement>((resolve) => {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(new Image());

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = getImageUrl(t.image_path);

        img.onload = () => {
          const centerX = t.x_center * img.width;
          const centerY = t.y_center * img.height;
          const angle = degreeToRadian(t.angle);
          const cropW = t.width * img.width;
          const cropH = t.height * img.height;
          const cropRatio = cropH / cropW;
          c.width = appender.clientWidth;
          c.height = cropRatio * appender.clientWidth;

          const scaleX = c.width / cropW;
          const scaleY = c.height / cropH;
          const scale = Math.min(scaleX, scaleY);

          ctx.save();
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.translate(c.width / 2, c.height / 2);
          ctx.scale(scale, scale);
          ctx.rotate(angle);
          ctx.drawImage(img, -centerX, -centerY);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.restore();

          const thumbImg = new Image();
          thumbImg.src = c.toDataURL('image/jpeg');
          if (type !== 'main') {
            thumbImg.id = t.image_path + '-' + t.confidence;
            thumbImg.className = 'final-single-' + type + '-thumb';
            thumbImg.style.cursor = 'pointer';
            thumbImg.onclick = () => this.setMainImage(t);
          }

          resolve(thumbImg);
        };
      });
    });

    return Promise.all(promises);
  }

  appendCroppedImgs(appender: HTMLElement | null, tfs: Transformation[], type?: 'main' | 'flagged' | 'notflagged'): void {
    if (!appender) return;

    tfs.map(t => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      if (!ctx) return;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = getImageUrl(t.image_path);

      img.onload = () => {
        const thumbImg = this.getCroppedImg(t, appender, c, ctx, img, type);
        if (type && type !== 'main') thumbImg.className = 'final-single-' + type + '-thumb';
        appender.appendChild(thumbImg);
      };

      img.onerror = () => { console.error('Failed to load image.') };
    });
  }

  private getCroppedImg(t: Transformation, appender: HTMLElement, c: HTMLCanvasElement, ctx: CanvasRenderingContext2D, img: HTMLImageElement, type?: string): HTMLImageElement {
    const centerX = t.x_center * img.width;
    const centerY = t.y_center * img.height;
    const angle = degreeToRadian(t.angle);
    const cropW = t.width * img.width;
    const cropH = t.height * img.height;

    let cropRatio = cropH / cropW;
    c.width = appender.clientWidth;
    c.height = cropRatio * appender.clientWidth;

    if (type === 'main' && this.mode() === 'final-single') {
      appender.style.height = '100%';
      cropRatio = cropW / cropH;
      c.width = cropRatio * appender.clientHeight;
      c.height = appender.clientHeight;
    }

    const scaleX = c.width / cropW;
    const scaleY = c.height / cropH;
    const scale = Math.min(scaleX, scaleY);

    ctx.save();
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(scale, scale);
    ctx.rotate(angle);
    ctx.drawImage(img, -centerX, -centerY);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();

    const thumbImg = new Image();
    thumbImg.src = c.toDataURL('image/jpeg');
    c.width > c.height
      ? thumbImg.style.width = '100%'
      : thumbImg.style.height = '100%';
    thumbImg.style.objectFit = 'contain';
    if (type !== 'main') thumbImg.onclick = () => this.setMainImage(t);

    return thumbImg;
  }

  private getMainFinalFullImage(mainContainer: HTMLElement, imgt: Transformation): void {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getImageUrl(imgt.image_path);

    img.onload = () => {
      mainContainer.style.height = '';
      c.width = mainContainer.clientWidth;
      c.height = (img.height / img.width) * c.width;

      ctx.drawImage(img, 0, 0, c.width, c.height);
      this.transformations().filter(t => t.image_path === imgt.image_path).map(t => this.drawRectangle(ctx, c.width, c.height, t));

      const mainImg = new Image();
      mainImg.src = c.toDataURL('image/jpeg');
      mainImg.style.width = '100%';
      mainImg.style.height = '100%';
      mainImg.style.objectFit = 'contain';
      mainContainer.appendChild(mainImg);
    };

    img.onerror = () => { console.error('Failed to load image.') };
  }

  private drawRectangle(ctx: CanvasRenderingContext2D, cWidth: number, cHeight: number, t: Transformation): void {
    const centerX = cWidth * t.x_center;
    const centerY = cHeight * t.y_center;
    const angle = degreeToRadian(t.angle);
    const width = cWidth * t.width;
    const height = cHeight * t.height;
    
    // Save current context state
    ctx.save();

    // Rotate
    ctx.translate(centerX, centerY);
    ctx.rotate(-angle);

    // Draw rectangle
    ctx.fillStyle = (t.crop_part === 1 ? this.leftColor : this.rightColor) + '10';
    ctx.strokeStyle = t.crop_part === 1 ? this.leftColor : this.rightColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    ctx.fill();
    ctx.stroke();

    // Restore context
    ctx.restore();
  }
}
