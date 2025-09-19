import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Image, ImageFlags, Transformation } from '../app.types';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);
  private serverBaseUrl = 'http://127.0.0.1:8000';

  images = signal<Image[]>([]);
  mainImageUrl = signal<string>('');
  transformations = signal<Transformation[]>([]);
  leftTransformations = computed<Transformation[]>(() => this.transformations().filter((t, i, a) => t.image_path === a[i + 1]?.image_path));
  rightTransformations = computed<Transformation[]>(() => this.transformations().filter((t, i, a) => t.image_path === a[i - 1]?.image_path));
  confidenceThreshold: number = .9;
  avgSideRation: number = 0;
  sideRationThreshold: number = .02;

  flaggedImages = computed<Image[]>(() => {    
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

    const result: Image[] = [];
    for (const img of imgs) {
      const f = flagsByName.get(img.name);
      if (f) result.push({ ...img, ...f });
    }

    return result;
  });

  notFlaggedImages = computed<Image[]>(() => {
    const flaggedNames = new Set(this.flaggedImages().map(f => f.name));
    return this.images().filter(img => !flaggedNames.has(img.name));
  });

  fetchImages(): Observable<Image[]> {
    return this.http.get<Image[]>(`${this.serverBaseUrl}/api/images`);
  }

  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${this.serverBaseUrl}/api/transformations`);
  }
}
