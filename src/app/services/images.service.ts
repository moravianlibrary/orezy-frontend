import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ImageItem, Transformation } from '../app.types';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);
  private serverBaseUrl = 'http://127.0.0.1:8000';

  // Previews
  images = signal<ImageItem[]>([]);
  flaggedImages = computed<ImageItem[]>(() => this.images().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.low_confidence && !img.bad_sides_ratio));

  transformations = signal<Transformation[]>([]);
  leftTransformations = computed<Transformation[]>(() => this.transformations().filter(t => t.crop_part === 1));
  rightTransformations = computed<Transformation[]>(() => this.transformations().filter(t => t.crop_part === 2));

  confidenceThreshold: number = .9;
  sideRatioThreshold: number = .1;
  avgSideRatio: number = 0;

  // Main
  mainImageName: string = '';
  modes: string[] = ['edit', 'final-single', 'final-full'];
  mode = signal<string>(this.modes[0]);
  leftColor: string = '#00BFFF';
  rightColor: string = '#FF10F0';

  fetchImages(): Observable<ImageItem[]> {
    return this.http.get<ImageItem[]>(`${this.serverBaseUrl}/api/images`);
  }

  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${this.serverBaseUrl}/api/transformations`);
  }

  setMainImage(imageName: string): void {
    const c = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    // Max size
    const rect = c.getBoundingClientRect();
    c.width = rect.width;
    c.height = rect.height;

    // Set mode & url
    this.mainImageName = imageName;

    // Draw image
    const img = new Image();
    img.src = this.getImageUrl(imageName);
    img.onerror = () => { console.error('Failed to load image.') };
    img.onload = () => {
      ctx.drawImage(img, 0, 0, c.width, c.height);

      // Show crops
      switch (this.mode()) {
        case 'edit':
          // this.transformations().filter(t => t.image_path === imageName).map(t => this.drawRectangle(ctx, c.width, c.height, t));
          break;
        case 'final-single':
          // this.transformations().filter(t => t.image_path === imageName).map(t => this.drawRectangle(ctx, c.width, c.height, t));
          break;
        case 'final-full':
          this.transformations().filter(t => t.image_path === imageName).map(t => this.drawRectangle(ctx, c.width, c.height, t));
          break;
      }
    };
  }
  
  private getImageUrl(imageName: string): string {
    return this.serverBaseUrl + '/images/' + imageName;
  }

  private drawRectangle(ctx: CanvasRenderingContext2D, cWidth: number, cHeight: number, t: Transformation): void {
    console.log(t);
    const centerX = cWidth * t.x_center;
    const centerY = cHeight * t.y_center;
    const angle = (t.angle * Math.PI) / 180;
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
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    ctx.fill();
    ctx.stroke();

    // Restore context
    ctx.restore();
  }
}
