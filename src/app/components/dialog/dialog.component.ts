import { Component, inject, output } from '@angular/core';
import { DimColor, GridMode, PageNumberType, ScanType } from '../../app.types';
import { EditorService } from '../../services/editor.service';
import { dimColorDict, filterPageNumberStartDict, filterScanTypeStartDict, gridModeDict } from '../../app.config';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dialog',
  imports: [FormsModule],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss'
})
export class DialogComponent {
  dashSvc = inject(DashboardService);
  edtSvc = inject(EditorService);
  authSvc = inject(AuthService);
  
  closed = output<void>();
  backdropClick = output<void>();

  gridModeDict: Record<GridMode, string> = gridModeDict;
  gridModeDictKeys = Object.keys(gridModeDict) as GridMode[];
  
  dimColorDict: Record<DimColor, string> = dimColorDict;
  dimColorDictKeys = Object.keys(dimColorDict) as DimColor[];

  filterScanTypeStartDict: Record<ScanType, string> = filterScanTypeStartDict;
  filterScanTypeStartDictKeys = Object.keys(filterScanTypeStartDict) as ScanType[];

  filterPageNumberStartDict: Record<PageNumberType, string> = filterPageNumberStartDict;
  filterPageNumberStartDictKeys = Object.keys(filterPageNumberStartDict) as PageNumberType[];

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.backdropClick.emit();
    this.close();

    const edtSvc = this.edtSvc;
    if (this.edtSvc.dialogTitle() === 'Nastavení') this.edtSvc.gridRadio.set(edtSvc.gridMode());
  }

  toggleOutline(): void {
    const edtSvc = this.edtSvc;
    edtSvc.outlineTransparent = !edtSvc.outlineTransparent;
    localStorage.setItem('outlineTransparent', `${edtSvc.outlineTransparent}`);
  }
}
