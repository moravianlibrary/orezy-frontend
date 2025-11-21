import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, HostListener, input, ViewChild } from '@angular/core';
import { NgClass } from '../../../../node_modules/@angular/common';

@Component({
  selector: 'app-menu',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgClass],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent {
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menu.nativeElement.contains(event.target)) this.show = false;
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

  resetScan(): void {
    console.log('should reset scan');
  }
}
