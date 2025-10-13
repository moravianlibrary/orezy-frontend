import { Component, inject, input } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { books } from '../../app.config';

@Component({
  selector: 'app-button-group',
  imports: [],
  templateUrl: './button-group.component.html',
  styleUrl: './button-group.component.scss'
})
export class ButtonGroupComponent {
  private imagesService = inject(ImagesService);
  
  items = input<string[]>([]);
  currentItem = input<string>('');

  select(item: string): void {
    const items = this.items();
    
    switch (items) {
      case books:
        this.handleBookSelection(item);
        break;
      case this.imagesService.modes:
        this.handleModeSelection(item);
        break;
    }

    this.updateMainImage();
  }

  private handleBookSelection(item: string): void {
    if (this.imagesService.lastBook === item) return;

    this.imagesService.lastBook = item;
    this.imagesService.book.set(item);
    localStorage.setItem('book', item);
    window.location.reload();
  }

  private handleModeSelection(item: string): void {
    if (this.imagesService.lastMode === item) return;

    this.imagesService.lastMode = item;
    this.imagesService.mode.set(item);
    localStorage.setItem('mode', item);
  }

  private updateMainImage(): void {
    const { mode, mainImageItem, images, croppedImages } = this.imagesService;
    const currentMode = mode();
    const currentName = mainImageItem().name;

    const mainCanvas = document.getElementById('main-canvas') as HTMLElement;
    if (mainCanvas) mainCanvas.style.opacity = currentMode === 'full' ? '1' : '0';

    const imageSource = currentMode === 'full' ? images() : croppedImages();
    const newImage = imageSource.find(img => img.name === currentName);

    if (newImage) this.imagesService.setMainImage(newImage);
  }
}
