import { Component, inject, signal } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { ImageItem } from '../../app.types';
import { scrollToSelectedImage } from '../../utils/utils';

@Component({
  selector: 'app-left-panel',
  imports: [],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.scss'
})
export class LeftPanelComponent {
  imagesService = inject(ImagesService);

  selectedFilter: string = 'flagged';

  setDisplayedImages(filter: string): void {
    this.selectedFilter = filter;
    
    switch (filter) {
      case 'all':
        this.imagesService.displayedImages.set(this.imagesService.images());
        break;
      case 'flagged':
        this.imagesService.displayedImages.set(this.imagesService.flaggedImages());
        break;
      case 'edited':
        this.imagesService.displayedImages.set(this.imagesService.editedImages());
        break;
      case 'ok':
        this.imagesService.displayedImages.set(this.imagesService.notFlaggedImages());
        break;
    }

    const newImage = this.imagesService.displayedImages().find(img => img.name === this.imagesService.mainImageItem().name)
      || this.imagesService.displayedImages()[0]
      || { url: '' };
    this.imagesService.setMainImage(newImage);

    scrollToSelectedImage();
  }

  getStatusIconTooltip(image: ImageItem): string {
    let result = '';
    
    if (!image.low_confidence && !image.bad_sides_ratio) result = 'OK';
    if (image.low_confidence && image.bad_sides_ratio) result = 'Nízká důvěra a špatný poměr stran';
    if (image.low_confidence && !image.bad_sides_ratio) result = 'Nízká důvěra';
    if (!image.low_confidence && image.bad_sides_ratio) result = 'Špatný poměr stran';

    return result;
  }

  toggleMorePreview(): void {
    this.imagesService.toggledMore = !this.imagesService.toggledMore;
  }

  ngAfterViewInit(): void {
    this.imagesService.displayedImages.set(this.imagesService.flaggedImages());
  }
}
