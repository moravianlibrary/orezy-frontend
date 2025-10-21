import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-properties-panel',
  imports: [FormsModule],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss'
})
export class PropertiesPanelComponent {
  imagesService = inject(ImagesService);
}
