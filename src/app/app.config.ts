import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ImagesService } from './services/images.service';
import { forkJoin, tap } from 'rxjs';
import { ImageFlags, ImageItem } from './app.types';

export const serverBaseUrl: string = 'https://ai-orezy-data.test.api.trinera.cloud/Y6QBR1bLTTYxGBszk0rnhopOF';
export const bookId: string = '2619387078';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const imagesService = inject(ImagesService);
      return forkJoin({
        imgs: imagesService.fetchImages(),
        tfs: imagesService.fetchTransformations()
      }).pipe(
        tap(({ imgs, tfs }) => {
          imagesService.avgSideRatio = tfs.length ? tfs.reduce((sum, t) => sum + t.width / t.height, 0) / tfs.length : 0;
          const flagsByName = new Map<string, ImageFlags>();

          // Enrich transformations...
          for (const t of tfs) {
            
            // ...by low_confidence and bad_sides_ratio
            const ratioDiff = Math.abs(t.width/t.height - imagesService.avgSideRatio);
            t.low_confidence = t.confidence < imagesService.confidenceThreshold;
            t.bad_sides_ratio = ratioDiff > imagesService.sideRatioThreshold;

            const flags: ImageFlags = flagsByName.get(t.image_path) ?? {};
            flags.low_confidence = flags.low_confidence ? flags.low_confidence : t.low_confidence;
            flags.bad_sides_ratio = flags.bad_sides_ratio ? flags.bad_sides_ratio : t.bad_sides_ratio;
            flagsByName.set(t.image_path, flags);
            
            // ...by crop_part
            t.crop_part = t.x_center > 0.6 ? 2 : 1;
          }

          // Enrich images
          const resultImages: ImageItem[] = [];
          for (const img of imgs) {
            const f = flagsByName.get(img.name ?? '');
            resultImages.push({ ...img, ...f });
          }
          
          // Get mode
          const mode = localStorage.getItem('mode');
          if (mode) imagesService.mode.set(mode);

          // Preset everything
          imagesService.images.set(resultImages);
          imagesService.transformations.set(tfs);
          imagesService.setCroppedImgs(tfs);
        })
      );
    })
  ]
};
