import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ImagesService } from './services/images.service';
import { firstValueFrom } from 'rxjs';
import { ImageFlags, ImageItem } from './app.types';
import { EnvironmentService } from './services/environment.service';
import { roundToDecimals } from './utils/utils';

export const books = ['2610078027', '2610267219', '2619387078', '2619611960', '2619711148'];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    provideAppInitializer(() => {
      // Inject services
      const envService = inject(EnvironmentService);
      const imagesService = inject(ImagesService);

      return (async () => {
        // Wait for environment to load
        await envService.load();
        const serverBaseUrl = envService.get('serverBaseUrl') as string;
        console.log('Using serverBaseUrl:', serverBaseUrl);

        const book = localStorage.getItem('book');
        if (book) imagesService.book.set(book);

        // Load transformations as Promise
        const tfs = await firstValueFrom(imagesService.fetchTransformations());

        // Continue
        const imgs = Array.from(new Map(tfs.map(t => [t.image_path, t])).values())
          .map(t => ({ name: t.image_path, url: `${serverBaseUrl}/${t.image_path}` }));

        const flagsByName = new Map<string, ImageFlags>();
        imagesService.avgSideRatio = tfs.length ? tfs.reduce((sum, t) => sum + t.width / t.height, 0) / tfs.length : 0;

        let cropPartCount = 0;
        let cropPartSum = 0;
        let widthSum = 0;
        let heightSum = 0;

        // Enrich transformations...
        for (let i = 0; i < tfs.length; i++) {
          const prevT = i > 0 ? tfs[i - 1] : null;
          const t = tfs[i];

          // ...by low_confidence and bad_sides_ratio
          const ratioDiff = Math.abs(t.width / t.height - imagesService.avgSideRatio);
          t.low_confidence = t.confidence < imagesService.confidenceThreshold;
          t.bad_sides_ratio = ratioDiff > imagesService.sideRatioThreshold;

          const flags: ImageFlags = flagsByName.get(t.image_path) ?? {};
          flags.low_confidence = flags.low_confidence ? flags.low_confidence : t.low_confidence;
          flags.bad_sides_ratio = flags.bad_sides_ratio ? flags.bad_sides_ratio : t.bad_sides_ratio;
          flagsByName.set(t.image_path, flags);

          // ...by crop_part and color
          t.crop_part = t.image_path === prevT?.image_path ? (prevT.crop_part + 1) : 1;
          t.color = t.crop_part === 1 ? imagesService.leftColor : imagesService.rightColor;

          // Calc stuff
          if (t.image_path === prevT?.image_path) cropPartSum -= 1;
          cropPartCount += 1;
          cropPartSum += 1;
          widthSum += t.width;
          heightSum += t.height;
        }

        // Enrich images
        const resultImages: ImageItem[] = [];
        for (const img of imgs) {
          const f = flagsByName.get(img.name ?? '');
          resultImages.push({
            ...img,
            ...f,
            rects: tfs
              .filter(t => t.image_path === img.name)
              .map(t => {
                return {
                  id: `${t.image_path}-${t.crop_part}`,
                  x_center: roundToDecimals(t.x_center),
                  y_center: roundToDecimals(t.y_center),
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: roundToDecimals(t.width),
                  height: roundToDecimals(t.height),
                  angle: roundToDecimals(t.angle, 2),
                  crop_part: t.crop_part,
                  color: t.color,
                  edited: false
                }
              })
          });
        }

        // Preset everything
        imagesService.images.set(resultImages);
        imagesService.originalImages.set(resultImages);
        imagesService.originalTransformations.set(tfs);
        // imagesService.setCroppedImgs(tfs);
        // imagesService.maxRects = Math.round(cropPartCount / cropPartSum);
        imagesService.avgRect = { width: widthSum / tfs.length, height: heightSum / tfs.length };

        // Mode
        imagesService.mode.set('full');
        // if (imagesService.maxRects === 1) {
        //   imagesService.modes = ['single'];
        //   imagesService.mode.set('single');
        // } else {
        //   const localMode = localStorage.getItem('mode');
        //   if (localMode) imagesService.mode.set(localMode);
        // }

        // Nic nevracíme – Promise<void> splněna
      })();
    }),
  ]
};
