import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Image } from '../app.types';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);
  private imagesBaseUrl = 'http://127.0.0.1:8000';

  images = signal<Image[]>([]);
  imageUrls = computed(() => this.images().map((i: Image) => i.url));

  fetchImages(): Observable<Image[]> {
    return this.http.get<Image[]>(`${this.imagesBaseUrl}/api/images`);
  }
}
