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
  imagesService = inject(ImagesService);
  items = input<string[]>([]);
  currentItem = input<string>('');

  select(item: string): void {
    switch (this.items()) {
      case books:
        if (this.imagesService.lastBook === item) return;
        this.imagesService.lastBook = item;
        this.imagesService.book.set(item);
        localStorage.setItem('book', item);
        window.location.reload();
        break;
    
      case this.imagesService.modes:
        if (this.imagesService.lastMode === item) return;
        this.imagesService.lastMode = item;
        this.imagesService.mode.set(item);
        localStorage.setItem('mode', item);
        break;
    }

    const mode = this.imagesService.mode();
    this.imagesService.setMainImage(
      mode === 'full'
        ? this.imagesService.images().filter(img => img.name === this.imagesService.mainImageItem().name)[0]
        : this.imagesService.croppedImages().filter(img => img.name === this.imagesService.mainImageItem().name)[0]
    );

    (document.getElementById('main-canvas') as HTMLElement).style.opacity = mode === 'full' ? '1' : '0';
  }
}
