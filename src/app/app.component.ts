import { Component, inject } from '@angular/core';
import { MainComponent } from './layout/main/main.component';
import { LeftPanelComponent } from './layout/left-panel/left-panel.component';
import { RightPanelComponent } from './layout/right-panel/right-panel.component';
import { ImagesService } from './services/images.service';
import { EnvironmentService } from './services/environment.service';
import { BottomPanelComponent } from './layout/bottom-panel/bottom-panel.component';

@Component({
  selector: 'app-root',
  imports: [MainComponent, BottomPanelComponent, LeftPanelComponent, RightPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  imagesService = inject(ImagesService);
  envService = inject(EnvironmentService);

  ngOnInit(): void {
    this.logDevInfo();
  }

  logDevInfo(): void {
    const devInfo = {
      useStaticRuntimeConfig: this.envService.get('useStaticRuntimeConfig'),
      devMode: this.envService.get('devMode'),
      environmentCode: this.envService.get('environmentCode'),
      environmentName: this.envService.get('environmentName'),

      serverBaseUrl: this.envService.get('serverBaseUrl'),

      gitCommitHash: this.envService.get('git_commit_hash'),
      gitTag: this.envService.get('git_tag'),
      buildDate: this.envService.get('build_date'),
    };
    console.log('Dev Info:', devInfo);
    if (devInfo.gitCommitHash) {
      console.log('https://github.com/trineracz/orezy-frontend/commit/' + devInfo.gitCommitHash);
    }
  }

}

