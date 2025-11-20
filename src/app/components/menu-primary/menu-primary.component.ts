import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';

@Component({
  selector: 'app-menu-primary',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  templateUrl: './menu-primary.component.html',
  styleUrl: './menu-primary.component.scss'
})
export class MenuPrimaryComponent {

  /* ------------------------------
    TOGGLE BEHAVIOR
  ------------------------------ */
  @ViewChild('menuPrimary', { static: true }) menuPrimary!: ElementRef;
  show = false;
  positions: ConnectedPosition[] = [
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top'
    }
  ];

  toggleMenuPrimary(): void {
    this.show = !this.show;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuPrimary.nativeElement.contains(event.target)) this.show = false;
  }


  /* ------------------------------
    ACTIONS
  ------------------------------ */
  upload(): void {
    console.log('should upload');
  }

  resetDoc(): void {
    console.log('should reset doc');
  }
}
