import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ImagesService } from './services/images.service';
import { forkJoin, of, tap } from 'rxjs';
import { ImageFlags, ImageItem } from './app.types';

export const serverBaseUrl: string = 'https://ai-orezy-data.test.api.trinera.cloud/Y6QBR1bLTTYxGBszk0rnhopOF';
export const books = ['2610078027', '2610267219', '2619387078', '2619611960', '2619711148'];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const imagesService = inject(ImagesService);
      const book = localStorage.getItem('book');
      if (book) imagesService.book.set(book);
      return imagesService.fetchTransformations().pipe(
        tap(tfs => {
          const imgs = Array.from(
            new Map(tfs.map(t => [t.image_path, t])).values()
          ).map(t => ({
            name: t.image_path,
            url: `${serverBaseUrl}/${t.image_path}`,
          }));
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
            
            // ...by crop_part and color
            t.crop_part = t.x_center > 0.6 ? 2 : 1;
            t.color = t.crop_part === 1 ? imagesService.leftColor : imagesService.rightColor;
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
