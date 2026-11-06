import { describe, expect, it } from 'vitest';
import { catalogKey, createCatalog } from '../catalog';
import { BASEPLATE_FOR_SIZE, DEFAULT_DESIGN, FACE_SCALE, faceValue, sanitizeDesign } from './design';

describe('tasarım verisi v2', () => {
  it('v1 tasarımı v2ye çevrilir', () => {
    const d = sanitizeDesign({ facialHair: 'beard', hairStyle: 'bald', shirtColor: 'blue' });
    expect(d.facialHair).toBe('fullBeard');
    expect(d.size).toBe('M');
    expect(d.face).toEqual(DEFAULT_DESIGN.face);
    expect(d.shirtColor).toBe('blue');
  });
  it('seviyeler sınırlanır ve tamsayıya yuvarlanır', () => {
    const d = sanitizeDesign({ face: { browTilt: 99, eyeWidth: -3, noseWidth: 1.6 } });
    expect([d.face.browTilt, d.face.eyeWidth, d.face.noseWidth]).toEqual([4, 0, 2]);
  });
  it('ifade aralıkları uygulanır', () => {
    const d = sanitizeDesign({ expression: { smile: 7, browRaiseL: -5, eyeOpen: 0 } });
    expect(d.expression).toEqual({ smile: 3, browRaiseL: -1, browRaiseR: 0, eyeOpen: 0 });
  });
  it('geçersiz boyut varsayılana döner', () => {
    expect(sanitizeDesign({ size: 'XL' }).size).toBe('M');
  });
  it('katalogda kapalı renk aynı gruptaki en yakın açık renge düşer', () => {
    const keys = ['black', 'white', 'lightNougat', 'darkBrown', 'darkBlue'].map((c) => catalogKey('p1x1', c));
    const d = sanitizeDesign({ skin: 'nougat', shirtColor: 'blue' }, createCatalog(keys));
    expect(d.skin).toBe('lightNougat');
    expect(d.shirtColor).toBe('darkBlue');
  });
  it('bilinmeyen ve geçersiz girdiler varsayılana döner', () => {
    expect(sanitizeDesign(null)).toEqual(DEFAULT_DESIGN);
    expect(sanitizeDesign({ face: 'x', expression: 5, facialHair: 'zzz', hairline: 'a', beardLine: 7 }).beardLine).toBe(2);
    const d = sanitizeDesign({ face: { bogus: 1, eyeWidth: NaN }, facialHair: 'zzz', skin: 'transClear' });
    expect(d.facialHair).toBe('none');
    expect(d.face.eyeWidth).toBe(FACE_SCALE.eyeWidth.def);
    expect(d.skin).toBe(DEFAULT_DESIGN.skin);
    expect(Object.keys(d.face)).not.toContain('bogus');
  });
  it('yeni bayraklar ve faceValue', () => {
    const d = sanitizeDesign({ collar: true, jacketOpen: false });
    expect([d.collar, d.jacketOpen]).toEqual([true, false]);
    expect(faceValue(DEFAULT_DESIGN, 'browHeight')).toBe(0.745);
  });
  it('kaide kapalıysa açık ilk renge, hiç yoksa base=false', () => {
    const plate = BASEPLATE_FOR_SIZE.M;
    const withPlate = createCatalog([catalogKey(plate, 'white'), catalogKey('p1x1', 'darkGray')]);
    const d = sanitizeDesign({ size: 'M' }, withPlate);
    expect(d.base).toBe(true);
    expect(d.baseColor).toBe('white');
    const none = createCatalog([catalogKey('p1x1', 'darkGray')]);
    expect(sanitizeDesign({}, none).base).toBe(false);
  });
});
