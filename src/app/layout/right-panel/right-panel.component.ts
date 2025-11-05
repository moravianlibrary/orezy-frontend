import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-right-panel',
  imports: [FormsModule],
  templateUrl: './right-panel.component.html',
  styleUrl: './right-panel.component.scss'
})
export class RightPanelComponent {
  imagesService = inject(ImagesService);

  getCurrentIndexImage(): number {
    return this.imagesService.displayedImages().findIndex(img => img.name === this.imagesService.mainImageItem().name) + 1;
  }
}
