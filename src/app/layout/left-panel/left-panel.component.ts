import { Component, inject, signal } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { ImageItem } from '../../app.types';
import { defer, scrollToSelectedImage } from '../../utils/utils';

@Component({
  selector: 'app-left-panel',
  imports: [],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.scss'
})
export class LeftPanelComponent {
  imagesService = inject(ImagesService);

  clickFilter(filter: string): void {
    const imgSvc = this.imagesService;
    imgSvc.selectedFilter = filter;
    
    const mainImageItemName = imgSvc.mainImageItem().name;
    if (imgSvc.wasEdited) {
      imgSvc.updateImagesByEdited(mainImageItemName ?? '');
    }

    imgSvc.setDisplayedImages();

    const newImage = imgSvc.displayedImages().find(img => img.name === mainImageItemName)
      || imgSvc.displayedImages()[0]
      || { url: '' };
    imgSvc.setMainImage(newImage);

    scrollToSelectedImage();
  }

  clickThumbnail(image: ImageItem): void {
    this.imagesService.setMainImage(image);
    if (this.imagesService.wasEdited) defer(() => this.imagesService.setDisplayedImages(), 100);
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
