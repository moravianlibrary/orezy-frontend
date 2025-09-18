import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ImagesService } from './services/images.service';
import { tap } from 'rxjs';
import { Image } from './app.types';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const imagesService = inject(ImagesService);
      return imagesService.fetchImages().pipe(
        tap((response: Image[]) => imagesService.images.set(response))
      );
    })
  ]
};
