import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ICON_NAME_MAP } from './icon-name.map';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
  });

  function glyphText(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
  }

  it.each(Object.entries(ICON_NAME_MAP))(
    'resolves name "%s" to its mapped glyph',
    (name, glyph) => {
      fixture.componentInstance.name = name;
      fixture.detectChanges();

      expect(glyphText()).toBe(glyph);
    },
  );

  it('renders the "error" fallback glyph and warns for an unknown name', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    fixture.componentInstance.name = 'this-name-does-not-exist';
    fixture.detectChanges();

    expect(glyphText()).toBe('error');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('this-name-does-not-exist');

    warnSpy.mockRestore();
  });

  it('defaults to aria-hidden="true" (decorative)', () => {
    fixture.componentInstance.name = 'home';
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('applies the vf-icon--spin class when spin is true', () => {
    fixture.componentInstance.name = 'spinner';
    fixture.componentInstance.spin = true;
    fixture.detectChanges();

    const span = (fixture.nativeElement as HTMLElement).querySelector('span');
    expect(span?.classList.contains('vf-icon--spin')).toBe(true);
  });
});
