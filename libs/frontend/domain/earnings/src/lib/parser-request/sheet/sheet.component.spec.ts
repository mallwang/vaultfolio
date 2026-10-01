import { TestBed } from '@angular/core/testing';
import { anonymizeLayout, type AnonPage } from '@vaultfolio/earnings';
import { plantedLayout } from '../parser-request.testing';
import { SheetComponent, type WordClick } from './sheet.component';

describe('SheetComponent', () => {
  function render(pages: AnonPage[]) {
    const fixture = TestBed.createComponent(SheetComponent);
    fixture.componentRef.setInput('pages', pages);
    const clicks: WordClick[] = [];
    fixture.componentInstance.wordClick.subscribe((c) => clicks.push(c));
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, clicks };
  }
  const word = (root: HTMLElement, id: string) =>
    root.querySelector(`[data-testid="request-word-${id}"]`) as HTMLButtonElement;
  const pages = () => anonymizeLayout(plantedLayout(), new Map(), () => 0.5).pages;

  it('renders every word as a button with a stable test id and a mark', () => {
    const { root } = render(pages());
    expect(root.querySelectorAll('button.word')).toHaveLength(12);
    expect(word(root, '0-0-0').classList).toContain('word--needs_decision');
    expect(word(root, '0-4-0').textContent?.trim()).toBe('Brutto');
    expect(word(root, '0-4-0').classList).toContain('word--label');
    expect(word(root, '0-4-1').classList).toContain('word--value');
  });

  it('emits the position of a clicked word', () => {
    const { root, clicks } = render(pages());
    word(root, '0-0-1').click();
    expect(clicks).toEqual([{ page: 0, line: 0, index: 1 }]);
  });

  it('disables removed (locked) words so a click does nothing', () => {
    const { root, clicks } = render(pages());
    const removed = word(root, '0-3-1');
    expect(removed.disabled).toBe(true);
    removed.click();
    expect(clicks).toEqual([]);
  });

  it('is operable by keyboard (words are real buttons)', () => {
    const { root } = render(pages());
    expect(word(root, '0-0-0').tagName).toBe('BUTTON');
    expect(word(root, '0-0-0').getAttribute('type')).toBe('button');
  });

  it('positions words by the page coordinates in percent', () => {
    const { root } = render(pages());
    expect(word(root, '0-4-0').style.left).toContain('9.52');
  });
});
