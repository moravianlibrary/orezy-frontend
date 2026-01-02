import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-bottom-panel',
  imports: [],
  templateUrl: './bottom-panel.component.html',
  styleUrl: './bottom-panel.component.scss'
})
export class BottomPanelComponent {
  imagesService = inject(ImagesService);

  get wasAnyPageEdited(): boolean {
    return Boolean(this.imagesService.currentPages.find(p => p.edited));
  }
}
