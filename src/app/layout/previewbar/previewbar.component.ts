import { Component, inject, signal } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { defer, getImageUrl } from '../../utils/utils';

@Component({
  selector: 'app-previewbar',
  imports: [],
  templateUrl: './previewbar.component.html',
  styleUrl: './previewbar.component.scss'
})
export class PreviewbarComponent {
  imagesService = inject(ImagesService);
  previewbarHTML = signal<string>('');

  getImageUrl = getImageUrl;

  toggleMorePreview(): void {
    this.imagesService.toggledMore = !this.imagesService.toggledMore;
    if (this.imagesService.toggledMore) this.imagesService.loadCroppedImgs('notflagged');
  }

  ngAfterViewInit(): void {
    this.imagesService.loadCroppedImgs('flagged');
  }
}
