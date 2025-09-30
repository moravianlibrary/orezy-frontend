import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';

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
    
    const mainContainer = document.getElementById('main-container') as HTMLElement;
    mainContainer.style.width = mode === 'final-full' ? '100%' : 'initial';
    mainContainer.style.height = mode === 'final-full' ? '100%' : 'initial';

    this.imagesService.setMainImage(
      mode === 'final-full'
        ? this.imagesService.images().filter(img => img.name === this.imagesService.mainImageItem().name)[0]
        : this.imagesService.croppedImages().filter(img => img.name === this.imagesService.mainImageItem().name)[0]
    );
  }
  //   if (this.imagesService.lastMode === mode) return;

  //   this.imagesService.lastMode = mode;
  //   this.imagesService.mode.set(mode);
  //   localStorage.setItem('mode', mode);
    
  //   this.imagesService.setMainImage(this.imagesService.mainImageItem());

  //   const thumbsFlagged = document.querySelectorAll<HTMLImageElement>('.final-single-flagged-thumb');
  //   const thumbsNotFlagged = document.querySelectorAll<HTMLImageElement>('.final-single-notflagged-thumb');

  //   if (mode === 'final-full') {
  //     this.toggleThumbs(thumbsFlagged, false);
  //     this.toggleThumbs(thumbsNotFlagged, false);
  //     return;
  //   }

  //   // Handle flagged thumbs
  //   !this.imagesService.flaggedCroppedImages.length
  //     ? this.imagesService.loadCroppedImgs('flagged')
  //     : this.toggleThumbs(thumbsFlagged, true);

  //   if (!this.imagesService.toggledMore) return;

  //   // Handle not-flagged thumbs
  //   !this.imagesService.notFlaggedCroppedImages.length
  //     ? this.imagesService.loadCroppedImgs('notflagged')
  //     : this.toggleThumbs(thumbsNotFlagged, true);
  // }

  // private toggleThumbs = (thumbs: NodeListOf<HTMLImageElement>, visible: boolean) => {
  //   thumbs.forEach(img => (img.style.display = visible ? 'initial' : 'none'));
  // };
}
