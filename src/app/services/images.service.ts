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
  leftTransformations = computed<Transformation[]>(() => this.transformations().filter(t => t.image_part === 1));
  rightTransformations = computed<Transformation[]>(() => this.transformations().filter(t => t.image_part === 2));
  confidenceThreshold: number = .9;
  avgSideRatio: number = 0;
  sideRatioThreshold: number = .02;

  flaggedImages = computed<ImageItem[]>(() => this.images().filter(img => img.low_confidence || img.bad_sides_ratio));
  notFlaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.low_confidence && !img.bad_sides_ratio));

  mode = signal<'edit' | 'final'>('final');

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
    this.mainImageUrl = imageUrl;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, c.width, c.height);
    };

    img.onerror = () => {
      console.error('Failed to load image.');
    };
  }
}
