import { Component, ElementRef, ViewChild, forwardRef, input, computed, signal, inject, output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectOption } from '../../app.types';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-select',
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  dashSvc = inject(DashboardService);
  
  options = input<SelectOption[]>([]);
  placeholder = input<string>('');
  usedIn = input<boolean>(false);
  usedOut = output<boolean>();

  @ViewChild('comboInput', { static: true }) comboInput!: ElementRef<HTMLInputElement>;

  isOpen = signal<boolean>(false);
  value = signal<number>(0);
  label = signal<string>('');

  displayedLabel = computed<string>(() => {
    const label = this.label();
    const selectedOption = this.selectedOption();
    return this.isOpen()
      ? label
      : selectedOption ? selectedOption.label : '';
  });

  selectedOption = computed<SelectOption | undefined>(() => {
    return this.options().find(o => o.value === this.value());
  });

  filteredOptions = computed<SelectOption[]>(() => {
    const label = this.label().trim().toLowerCase();
    const opts = this.options();
    if (!label) return opts;
    return opts.filter(o => o.label.toLowerCase().includes(label));
  });

  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: number | null): void {
    this.value.set(v ?? 0);
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  open(): void {
    this.isOpen.set(true);
    this.label.set('');
  }

  close(): void {
    this.isOpen.set(false);
    this.onTouched();
  }

  select(opt: SelectOption): void {
    this.value.set(opt.value);
    this.onChange(opt.value);
    this.label.set(opt.label);
    this.usedOut.emit(true);
    this.blur();
  }

  focus(): void {
    this.comboInput.nativeElement.focus();
  }

  blur(): void {
    this.comboInput.nativeElement.blur();
  }

  onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.label.set(v);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.blur();
      return;
    }
  }
}