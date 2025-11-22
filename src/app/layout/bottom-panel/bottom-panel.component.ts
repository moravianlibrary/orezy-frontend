import { Component, computed, inject, signal } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { defer, scrollToSelectedImage } from '../../utils/utils';
import { DialogButton } from '../../app.types';
import { DialogComponent } from '../../components/dialog/dialog.component';

@Component({
  selector: 'app-bottom-panel',
  imports: [DialogComponent],
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
    const imgSvc = this.imagesService;
    const img = imgSvc.displayedImages().find(img => img._id === imgSvc.mainImageItem()._id);
    if (!img) return;
    imgSvc.setMainImage(img);
  }


  /* ------------------------------
    DOKONČIT
  ------------------------------ */
  dialogOpen = signal(false);
  dialogTitle = signal('');
  dialogButtons = signal<DialogButton[]>([]);

  openDialog(): void {
    const imgSvc = this.imagesService;

    this.dialogTitle.set('Opravdu chcete dokončit proces?');
    this.dialogButtons.set([
      { label: 'Ne, zrušit' },
      {
        label: 'Ano, dokončit',
        primary: true,
        action: () => {
          if (imgSvc.imgWasEdited) imgSvc.updateImagesByEdited(imgSvc.mainImageItem()._id);
          imgSvc.updatePages(imgSvc.book(), imgSvc.images())
            .subscribe({
              next: (r: { id: string }) => console.log(r),
              error: (err: Error) => console.error(err)
            })
        }
      }
    ]);

    this.dialogOpen.set(true);
    imgSvc.dialogOpened = true;
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }
}
