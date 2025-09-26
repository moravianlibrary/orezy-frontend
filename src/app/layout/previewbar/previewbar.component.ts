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
    const thumbsNotFlagged = document.querySelectorAll<HTMLImageElement>('.final-single-notflagged-thumb');

    if (this.imagesService.toggledMore) {
      if (!this.imagesService.notFlaggedCroppedImages.length) {
        this.imagesService.loadCroppedImgs('notflagged');
        return;
      }
    }

    thumbsNotFlagged.forEach(img => {
      img.style.display = this.imagesService.toggledMore ? 'initial' : 'none';
    });
  }

  ngAfterViewInit(): void {
    this.imagesService.loadCroppedImgs('flagged');
  }
}
