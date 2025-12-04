import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, HostListener, inject, input, ViewChild } from '@angular/core';
import { NgClass } from '../../../../node_modules/@angular/common';
import { ImagesService } from '../../services/images.service';
import { DialogComponent } from '../dialog/dialog.component';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-menu',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgClass, DialogComponent],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent {
  imagesService = inject(ImagesService);
  dialogService = inject(DialogService);
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

  openSettings(): void {
    const imgSvc = this.imagesService;
    const diaSvc = this.dialogService;
    diaSvc.dialogTitle.set('Nastavení');
    diaSvc.dialogContent.set(true);
    diaSvc.dialogContentType.set('settings');
    diaSvc.dialogDescription.set(null);
    diaSvc.dialogButtons.set([
      { 
        label: 'Reset',
        action: () => {
          imgSvc.gridMode.set('when-rotating');
        }
      },
      {
        label: 'Uložit',
        primary: true,
        action: () => {
          imgSvc.gridMode.set(imgSvc.gridRadio());
        }
      }
    ]);

    diaSvc.dialogOpen.set(true);
    diaSvc.dialogOpened = true;
  }

  openShortcuts(): void {
    const diaSvc = this.dialogService;
    diaSvc.dialogTitle.set('Klávesové zkratky');
    diaSvc.dialogContent.set(true);
    diaSvc.dialogContentType.set('shortcuts');
    diaSvc.dialogDescription.set(null);
    diaSvc.dialogButtons.set([
      { 
        label: 'Zrušit'
      },
      {
        label: 'Rozumím',
        primary: true
      }
    ]);

    diaSvc.dialogOpen.set(true);
    diaSvc.dialogOpened = true;
  }

  resetDoc(): void {
    const diaSvc = this.dialogService;
    diaSvc.dialogTitle.set('Opravdu chcete resetovat změny?');
    diaSvc.dialogContent.set(false);
    diaSvc.dialogContentType.set(null);
    diaSvc.dialogDescription.set('Reset změn se týká celého dokumentu.');
    diaSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Resetovat celý dokument',
        primary: true,
        destructive: true,
        action: () => this.imagesService.resetDoc()
      }
    ]);

    diaSvc.dialogOpen.set(true);
    diaSvc.dialogOpened = true;
  }

  resetScan(): void {
    const diaSvc = this.dialogService;
    diaSvc.dialogTitle.set('Opravdu chcete resetovat změny?');
    diaSvc.dialogContent.set(false);
    diaSvc.dialogContentType.set(null);
    diaSvc.dialogDescription.set('Reset změn se týká aktuálního skenu.');
    diaSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Resetovat změny skenu',
        primary: true,
        destructive: true,
        action: () => this.imagesService.resetScan()
      }
    ]);

    diaSvc.dialogOpen.set(true);
    diaSvc.dialogOpened = true;
  }
}
