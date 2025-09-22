import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ImagesService } from './services/images.service';
import { forkJoin, tap } from 'rxjs';
import { ImageFlags, ImageItem } from './app.types';

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
          imagesService.avgSideRatio = transformations.length ? transformations.reduce((sum, t) => sum + t.width / t.height, 0) / transformations.length : 0;
          const flagsByName = new Map<string, ImageFlags>();

          // Enrich transformations by lowConfidence and badSidesRatio
          for (const t of transformations) {
            const ratioDiff = Math.abs(t.width/t.height - imagesService.avgSideRatio);
            t.lowConfidence = t.confidence < imagesService.confidenceThreshold;
            t.badSidesRatio = ratioDiff > imagesService.sideRatioThreshold;

            const flags: ImageFlags = flagsByName.get(t.image_path) ?? {};
            flags.lowConfidence = flags.lowConfidence ? flags.lowConfidence : t.lowConfidence;
            flags.badSidesRatio = flags.badSidesRatio ? flags.badSidesRatio : t.badSidesRatio;
            flagsByName.set(t.image_path, flags);
          }

          // Enrich images
          const resultImages: ImageItem[] = [];
          for (const img of images) {
            const f = flagsByName.get(img.name);
            resultImages.push({ ...img, ...f });
          }
          
          imagesService.images.set(resultImages);
          imagesService.transformations.set(transformations);
        })
      );
    })
  ]
};
