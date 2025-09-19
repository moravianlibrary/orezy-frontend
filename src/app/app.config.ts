import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ImagesService } from './services/images.service';
import { forkJoin, tap } from 'rxjs';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const imagesService = inject(ImagesService);
      return forkJoin({
        images: imagesService.fetchImages(),
        transformations: imagesService.fetchTransformations()
      }).pipe(
        tap(({ images, transformations }) => {
          imagesService.images.set(images);
          imagesService.transformations.set(transformations);
          imagesService.avgSideRation = transformations.reduce((acc, curr) => acc + curr.width/curr.height, 0) / transformations.length;
        })
      );
    })
  ]
};
