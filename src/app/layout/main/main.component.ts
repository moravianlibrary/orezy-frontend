import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImagesService } from '../../services/images.service';
import { ButtonGroupComponent } from '../../components/button-group/button-group.component';
import { getImageUrl } from '../../utils/utils';

@Component({
  selector: 'app-main',
  imports: [RouterOutlet, ButtonGroupComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  imagesService = inject(ImagesService);

  getImageUrl = getImageUrl;

  ngOnInit(): void {
    this.imagesService.setMainImage(this.imagesService.flaggedTransformations()[0]);
  }
}
