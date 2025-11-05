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

  clickFilter(filter: string): void {
    this.imagesService.selectedFilter = filter;
    
    if (this.imagesService.wasEdited) {
      this.imagesService.updateImagesByEdited();
    }

    this.imagesService.setDisplayedImages();

    const newImage = this.imagesService.displayedImages().find(img => img.name === this.imagesService.mainImageItem().name)
      || this.imagesService.displayedImages()[0]
      || { url: '' };
    this.imagesService.setMainImage(newImage);

    scrollToSelectedImage();
  }

  clickThumbnail(image: ImageItem): void {
    this.imagesService.setMainImage(image);
    if (this.imagesService.wasEdited) setTimeout(() => this.imagesService.setDisplayedImages(), 100);
  }

  getStatusIconTooltip(image: ImageItem): string {
    let result = '';
    
    if (!image.low_confidence && !image.bad_sides_ratio) result = 'OK';
    if (image.low_confidence && image.bad_sides_ratio) result = 'Nízká důvěra a špatný poměr stran';
    if (image.low_confidence && !image.bad_sides_ratio) result = 'Nízká důvěra';
    if (!image.low_confidence && image.bad_sides_ratio) result = 'Špatný poměr stran';
    if (image.edited) result = 'Upraveno';

    return result;
  }

  toggleMorePreview(): void {
    this.imagesService.toggledMore = !this.imagesService.toggledMore;
  }

  ngAfterViewInit(): void {
    this.imagesService.displayedImages.set(this.imagesService.flaggedImages());
  }
}
