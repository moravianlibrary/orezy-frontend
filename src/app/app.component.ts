import { Component } from '@angular/core';
import { MainComponent } from './main/main.component';
import { PreviewbarComponent } from './previewbar/previewbar.component';
import { ToolbarComponent } from './toolbar/toolbar.component';

@Component({
  selector: 'app-root',
  imports: [MainComponent, PreviewbarComponent, ToolbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'orezy-frontend';
}
