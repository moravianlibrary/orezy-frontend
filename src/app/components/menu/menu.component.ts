import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, inject, input, ViewChild } from '@angular/core';
import { NgClass } from '../../../../node_modules/@angular/common';
import { EditorService } from '../../services/editor.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-menu',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgClass],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent {
  edtSvc = inject(EditorService);
  authSvc = inject(AuthService);
  type = input('menu-primary');


  /* ------------------------------
    TOGGLE BEHAVIOR
  ------------------------------ */
  @ViewChild('menu', { static: true }) menu!: ElementRef;
  show = false;
  positions: ConnectedPosition[] = [
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top'
    }
  ];

  toggleMenu(): void {
    this.show = !this.show;
  }

  onSettingsClick(): void {
    this.edtSvc.openSettings();
    this.show = false;
  }

  onShortcutsClick(): void {
    this.edtSvc.openShortcuts();
    this.show = false;
  }

  onResetDocClick(): void {
    this.edtSvc.openResetDoc();
    this.show = !this.authSvc.canWriteTitle();
  }

  onResetScanClick(): void {
    this.edtSvc.openResetScan();
    this.show = !this.authSvc.canWriteTitle();
  }
}
