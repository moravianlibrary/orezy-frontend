import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ImageItem, ImageFlags, Transformation } from '../app.types';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);
  private serverBaseUrl = 'http://127.0.0.1:8000';

  images = signal<ImageItem[]>([]);
  mainImageUrl: string = '';
  transformations = signal<Transformation[]>([]);
  leftTransformations = computed<Transformation[]>(() => this.transformations().filter((t, i, a) => t.image_path === a[i + 1]?.image_path));
  rightTransformations = computed<Transformation[]>(() => this.transformations().filter((t, i, a) => t.image_path === a[i - 1]?.image_path));
  confidenceThreshold: number = .9;
  avgSideRation: number = 0;
  sideRationThreshold: number = .02;

  flaggedImages = computed<ImageItem[]>(() => {    
    const imgs = this.images();
    const tfs = this.transformations();

    const flagsByName = new Map<string, ImageFlags>();

    for (const t of tfs) {
      const ratioDiff = Math.abs(t.width/t.height - this.avgSideRation);
      const flags: ImageFlags = flagsByName.get(t.image_path) ?? {};

      if (t.confidence < this.confidenceThreshold) flags.lowConfidence = true;
      if (ratioDiff > this.sideRationThreshold) flags.badSidesRatio = true;
      if (flags.lowConfidence || flags.badSidesRatio) flagsByName.set(t.image_path, flags);
    }

    const result: ImageItem[] = [];
    for (const img of imgs) {
      const f = flagsByName.get(img.name);
      if (f) result.push({ ...img, ...f });
    }

    return result;
  });

  notFlaggedImages = computed<ImageItem[]>(() => {
    const flaggedNames = new Set(this.flaggedImages().map(f => f.name));
    return this.images().filter(img => !flaggedNames.has(img.name));
  });

  fetchImages(): Observable<ImageItem[]> {
    return this.http.get<ImageItem[]>(`${this.serverBaseUrl}/api/images`);
  }

  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${this.serverBaseUrl}/api/transformations`);
  }

  setMainImage(imageUrl: string): void {
    const c = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const rect = c.getBoundingClientRect();
    c.width = rect.width;
    c.height = rect.height;

    const img = new Image();
    img.src = imageUrl;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, c.width, c.height);
    };

    img.onerror = () => {
      console.error('Failed to load image.');
    };
  }
}
