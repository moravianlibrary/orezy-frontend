import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, HostListener, inject, input, signal, ViewChild } from '@angular/core';
import { NgClass } from '../../../../node_modules/@angular/common';
import { ImagesService } from '../../services/images.service';
import { catchError, of } from 'rxjs';
import { DialogButton, ImageItem } from '../../app.types';
import { DialogComponent } from '../dialog/dialog.component';

@Component({
  selector: 'app-menu',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgClass, DialogComponent],
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

  resetDoc(): void {
    this.dialogTitle.set('Opravdu chcete resetovat změny?');
    this.dialogContent.set(true);
    this.dialogDescription.set('Reset změn se týká celého dokumentu.');
    this.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Resetovat celý dokument',
        primary: true,
        destructive: true,
        action: () => {
          const imgSvc = this.imagesService;
          imgSvc.reset(imgSvc.book()).pipe(
            catchError(err => {
              console.error('Fetch error:', err);
              return of([]);
            })
          ).subscribe((response: ImageItem[]) => {
            imgSvc.images.set(response);
            imgSvc.originalImages.set(response);
            
            imgSvc.setDisplayedImages();
            imgSvc.setMainImage(imgSvc.displayedImages()[0]);
          });
        }
      }
    ]);

    this.dialogOpen.set(true);
    this.imagesService.dialogOpened = true;
  }

  resetScan(): void {
    this.dialogTitle.set('Opravdu chcete resetovat změny?');
    this.dialogContent.set(true);
    this.dialogDescription.set('Reset změn se týká aktuálního skenu.');
    this.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Resetovat změny skenu',
        primary: true,
        destructive: true,
        action: () => {
          const imgSvc = this.imagesService;
          if (!imgSvc.displayedImages().length) return;

          const mainImageItemBefore = imgSvc.mainImageItem();
          imgSvc.mainImageItem.set(imgSvc.originalImages().find(img => img._id === mainImageItemBefore._id) ?? mainImageItemBefore);
          const mainImageItemAfter = imgSvc.mainImageItem();
          imgSvc.images.update(prev =>
            prev.map(img => img._id === mainImageItemAfter._id
              ? mainImageItemAfter
              : img
            )
          );

          imgSvc.selectedFilter = mainImageItemAfter.edited ? 'edited' : (mainImageItemAfter.flags.length ? 'flagged' : 'ok');
          imgSvc.setDisplayedImages();
          imgSvc.setMainImage(mainImageItemAfter);
        }
      }
    ]);

    this.dialogOpen.set(true);
    this.imagesService.dialogOpened = true;
  }
}
