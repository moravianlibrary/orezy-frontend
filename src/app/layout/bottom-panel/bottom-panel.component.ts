import { Component, computed, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { defer, scrollToSelectedImage } from '../../utils/utils';

@Component({
  selector: 'app-bottom-panel',
  imports: [],
  templateUrl: './bottom-panel.component.html',
  styleUrl: './bottom-panel.component.scss'
})
export class BottomPanelComponent {
  imagesService = inject(ImagesService);

  
  /* ------------------------------
    SHOW PREV / NEXT IMAGE
  ------------------------------ */
  currentIndex = computed<number>(() => this.imagesService.displayedImages().findIndex(img => img._id === this.imagesService.mainImageItem()._id));

  showPrevImage(): void {
    if (this.currentIndex() === 0) return;
    this.showImage(-1);
    if (this.imagesService.imgWasEdited) defer(() => this.imagesService.setDisplayedImages(), 100);
  }

  showNextImage(): void {
    if (this.currentIndex() === this.imagesService.displayedImages().length - 1) return;
    this.showImage(1);
    if (this.imagesService.imgWasEdited) defer(() => this.imagesService.setDisplayedImages(), 100);
  }

  private showImage(offset: number): void {
    const displayedImages = this.imagesService.displayedImages();

    if (displayedImages.length === 0) return;

    const newIndex = (this.currentIndex() + offset + displayedImages.length) % displayedImages.length;
    this.imagesService.setMainImage(displayedImages[newIndex]);

    scrollToSelectedImage();
  }


  /* ------------------------------
    ZOOMS & FIT TO SCREEN
  ------------------------------ */
  fitToScreen(): void {
    const img = this.imagesService.displayedImages().find(img => img._id === this.imagesService.mainImageItem()._id);
    if (!img) return;
    this.imagesService.setMainImage(img);
  }
}
