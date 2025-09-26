import { Component, inject, input } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { defer } from '../../utils/utils';

@Component({
  selector: 'app-button-group',
  imports: [],
  templateUrl: './button-group.component.html',
  styleUrl: './button-group.component.scss'
})
export class ButtonGroupComponent {
  imagesService = inject(ImagesService);

  select(mode: string): void {
    if (this.imagesService.lastMode === mode) return;

    this.imagesService.lastMode = mode;
    this.imagesService.mode.set(mode);
    localStorage.setItem('mode', mode);
    
    this.imagesService.setMainImage(this.imagesService.mainImageTransformation);

    const thumbsFlagged = document.querySelectorAll('.final-single-flagged-thumb');
    const thumbsNotFlagged = document.querySelectorAll('.final-single-notflagged-thumb');
    if (mode === 'final-full') {
      thumbsFlagged.forEach(img => (img as HTMLImageElement).style.display = 'none');
      thumbsNotFlagged.forEach(img => (img as HTMLImageElement).style.display = 'none');
    } else {
      !this.imagesService.flaggedCroppedImages.length
        ? this.imagesService.loadCroppedImgs('flagged')
        : thumbsFlagged.forEach(img => (img as HTMLImageElement).style.display = 'initial');

      if (!this.imagesService.toggledMore) return;
      !this.imagesService.notFlaggedCroppedImages.length
        ? this.imagesService.loadCroppedImgs('notflagged')
        : thumbsNotFlagged.forEach(img => (img as HTMLImageElement).style.display = 'initial');
    }
  }
}
