import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-preview-panel',
  imports: [],
  templateUrl: './preview-panel.component.html',
  styleUrl: './preview-panel.component.scss'
})
export class PreviewPanelComponent {
  imagesService = inject(ImagesService);

  toggleMorePreview(): void {
    this.imagesService.toggledMore = !this.imagesService.toggledMore;
  }
}
