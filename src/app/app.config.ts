import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { EnvironmentService } from './services/environment.service';
import { GridMode } from './app.types';

export const defaultColor = '#00DDFF';
export const warningColor = '#FF9500';
export const errorColor = '#FF3A30';
export const editedColor = '#FFCC00';
export const transparentColor = '#00000000';
export const gridColor = '#FF000050';

export const flagMessages: Record<string, string> = {
  prediction_overlap: 'Výřezy se překrývají',
  page_count_mismatch: 'Chybějící výřez',
  no_prediction: 'Neúspěšná predikce',
  low_confidence: 'Nejistota',
  odd_dimensions: 'Podezřelý rozměr'
};

export const gridModeDict: Record<GridMode, string> = {
  'when-rotating': 'Při otáčení',
  'always': 'Vždy',
  'never': 'Nikdy'
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    provideAppInitializer(() => {
      // Inject services
      const envService = inject(EnvironmentService);

      return (async () => {
        // Wait for environment to load
        await envService.load();
        const serverBaseUrl = envService.get('serverBaseUrl') as string;
        console.log('Using serverBaseUrl:', serverBaseUrl);

        // Nic nevracíme – Promise<void> splněna
      })();
    }),
  ]
};
