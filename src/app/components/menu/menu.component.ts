import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, HostListener, inject, input, signal, ViewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '../../../../node_modules/@angular/common';
import { ImagesService } from '../../services/images.service';
import { DialogButton, GridMode } from '../../app.types';
import { DialogComponent } from '../dialog/dialog.component';
import { gridModeDict } from '../../app.config';

@Component({
  selector: 'app-menu',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgClass, DialogComponent, NgTemplateOutlet],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent {
  imagesService = inject(ImagesService);
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
    DIALOGS
  ------------------------------ */
  dialogOpen = signal<boolean>(false);
  dialogTitle = signal<string>('');
  dialogContent = signal<boolean>(false);
  dialogDescription = signal<string | null>(null);
  dialogButtons = signal<DialogButton[]>([]);

  closeDialog(): void {
    this.dialogOpen.set(false);
  }


  /* ------------------------------
    ACTIONS
  ------------------------------ */
  upload(): void {
    console.log('should upload');
  }

  gridModeDict: Record<GridMode, string> = gridModeDict;
  gridModeDictKeys = Object.keys(gridModeDict) as GridMode[];
  openSettings(): void {
    const imgSvc = this.imagesService;
    this.dialogTitle.set('Nastavení');
    this.dialogContent.set(true);
    this.dialogDescription.set(null);
    this.dialogButtons.set([
      { 
        label: 'Reset',
        action: () => {
          imgSvc.gridMode = 'when rotating';
        }
      },
      {
        label: 'Uložit',
        primary: true,
        action: () => {
          imgSvc.gridMode = imgSvc.gridRadio;
        }
      }
    ]);

    this.dialogOpen.set(true);
    imgSvc.dialogOpened = true;
  }

  resetDoc(): void {
    this.dialogTitle.set('Opravdu chcete resetovat změny?');
    this.dialogDescription.set('Reset změn se týká celého dokumentu.');
    this.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Resetovat celý dokument',
        primary: true,
        destructive: true,
        action: () => this.imagesService.resetDoc()
      }
    ]);

    this.dialogOpen.set(true);
    this.imagesService.dialogOpened = true;
  }

  resetScan(): void {
    this.dialogTitle.set('Opravdu chcete resetovat změny?');
    this.dialogDescription.set('Reset změn se týká aktuálního skenu.');
    this.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Resetovat změny skenu',
        primary: true,
        destructive: true,
        action: () => this.imagesService.resetScan()
      }
    ]);

    this.dialogOpen.set(true);
    this.imagesService.dialogOpened = true;
  }
}
