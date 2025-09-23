import { Component, inject, input } from '@angular/core';
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
    this.imagesService.mode.set(mode);
    this.imagesService.setMainImage(this.imagesService.mainImageName);
  }
}
