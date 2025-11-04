import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { scrollToSelectedImage } from '../../utils/utils';

@Component({
  selector: 'app-bottom-panel',
  imports: [],
  templateUrl: './bottom-panel.component.html',
  styleUrl: './bottom-panel.component.scss'
})
export class BottomPanelComponent {
  imagesService = inject(ImagesService);

  showPrevImage(): void {
    this.showImage(-1);
  }

  showNextImage(): void {
    this.showImage(1);
  }

  private showImage(offset: number): void {
    const displayedImages = this.imagesService.displayedImages();
    const currentIndex = displayedImages.findIndex(img => img.name === this.imagesService.mainImageItem().name);

    if (displayedImages.length === 0) return;

    const newIndex = (currentIndex + offset + displayedImages.length) % displayedImages.length;
    this.imagesService.setMainImage(displayedImages[newIndex]);

    scrollToSelectedImage();
  }
}
