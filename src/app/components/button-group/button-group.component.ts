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
    mainContainer.style.width = mode === 'full' ? '100%' : 'initial';
    mainContainer.style.height = mode === 'full' ? '100%' : 'initial';

    this.imagesService.setMainImage(
      mode === 'full'
        ? this.imagesService.images().filter(img => img.name === this.imagesService.mainImageItem().name)[0]
        : this.imagesService.croppedImages().filter(img => img.name === this.imagesService.mainImageItem().name)[0]
    );
  }
}
