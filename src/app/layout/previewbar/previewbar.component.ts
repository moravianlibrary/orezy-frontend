import { Component, inject, signal } from '@angular/core';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-previewbar',
  imports: [],
  templateUrl: './previewbar.component.html',
  styleUrl: './previewbar.component.scss'
})
export class PreviewbarComponent {
  imagesService = inject(ImagesService);
  previewbarHTML = signal<string>('');

  toggleMorePreview(): void {
    this.imagesService.toggledMore = !this.imagesService.toggledMore;
  }
}
