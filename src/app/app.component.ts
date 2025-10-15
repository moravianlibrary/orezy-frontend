import { Component, inject } from '@angular/core';
import { MainComponent } from './layout/main/main.component';
import { PreviewPanelComponent } from './layout/preview-panel/preview-panel.component';
import { PropertiesPanelComponent } from './layout/properties-panel/properties-panel.component';
import { ImagesService } from './services/images.service';

@Component({
  selector: 'app-root',
  imports: [MainComponent, PreviewPanelComponent, PropertiesPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  imagesService = inject(ImagesService);
}
